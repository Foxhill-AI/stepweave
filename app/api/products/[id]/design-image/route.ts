import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parsePlacementImages, isImageLayer } from '@/lib/designDraftState'

const BUCKET = 'design-patterns'
const SIGNED_URL_EXPIRES_IN = 3600 // 1 hour

/**
 * GET /api/products/[id]/design-image
 * Returns a signed URL for the product's raw design/pattern image.
 * Checks pattern_image_url first; falls back to the first image layer in
 * design_state.pattern_images (per-placement upload flow).
 *
 * Access: active products are public; draft products require ownership.
 * design_draft is queried with the service-role client to bypass RLS.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const productId = Number(id)
  if (Number.isNaN(productId)) {
    return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[design-image] Missing SUPABASE_SERVICE_ROLE_KEY or URL')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }
  const admin = createClient(supabaseUrl, serviceRoleKey)

  // Check product visibility using admin (RLS on product table is public SELECT)
  const supabase = await createServerSupabaseClient()
  const { data: product, error: productError } = await supabase
    .from('product')
    .select('id, user_account_id, status')
    .eq('id', productId)
    .maybeSingle()
  if (productError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const isActive = product.status === 'active'
  if (!isActive) {
    // Non-active product: require the owner to be signed in
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Product not available' }, { status: 403 })
    }
    const { data: userAccount } = await supabase
      .from('user_account')
      .select('id')
      .eq('auth_user_id', authUser.id)
      .maybeSingle()
    if (!userAccount || (product.user_account_id as number) !== userAccount.id) {
      return NextResponse.json({ error: 'Product not available' }, { status: 403 })
    }
  }

  // Use admin to bypass design_draft RLS — the product visibility check above
  // already guards access; only public or owner-verified products reach here.
  const { data: draft } = await admin
    .from('design_draft')
    .select('pattern_image_url, design_state')
    .eq('final_product_id', productId)
    .limit(1)
    .maybeSingle()

  if (!draft) {
    return NextResponse.json({ error: 'No design image for this product' }, { status: 404 })
  }

  // Resolve image path: prefer pattern_image_url, fall back to first per-placement image
  let path: string | null =
    typeof draft.pattern_image_url === 'string' && draft.pattern_image_url.trim()
      ? draft.pattern_image_url.trim()
      : null

  if (!path) {
    const placementImages = parsePlacementImages(
      draft.design_state && typeof draft.design_state === 'object' ? draft.design_state : {}
    )
    for (const layers of Object.values(placementImages)) {
      const imageLayer = layers.find(isImageLayer)
      if (imageLayer) {
        path = imageLayer.path
        break
      }
    }
  }

  if (!path) {
    return NextResponse.json({ error: 'No design image for this product' }, { status: 404 })
  }

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrls([path], SIGNED_URL_EXPIRES_IN)
  if (signError || !signed?.length || !signed[0]?.signedUrl) {
    console.error('[design-image] createSignedUrls:', signError?.message ?? 'no url')
    return NextResponse.json({ error: 'Could not generate image URL' }, { status: 500 })
  }

  return NextResponse.json({ url: signed[0].signedUrl })
}
