import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const BUCKET = 'design-patterns'
const SIGNED_URL_EXPIRES_IN = 3600 // 1 hour

/**
 * GET /api/products/[id]/design-image
 * Returns a signed URL for the product's design image when the product
 * was created from a design draft (design_draft.final_product_id = product.id).
 * Allowed when product is active (public) or when the requester is the product owner.
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
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()
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

  const { data: draft, error: draftError } = await supabase
    .from('design_draft')
    .select('pattern_image_url')
    .eq('final_product_id', productId)
    .limit(1)
    .maybeSingle()
  if (draftError || !draft) {
    return NextResponse.json({ error: 'No design image for this product' }, { status: 404 })
  }

  const path = draft.pattern_image_url
  if (!path || typeof path !== 'string' || path.trim() === '') {
    return NextResponse.json({ error: 'No design image for this product' }, { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[design-image] Missing SUPABASE_SERVICE_ROLE_KEY or URL')
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrls([path], SIGNED_URL_EXPIRES_IN)
  if (signError || !signed?.length || !signed[0]?.signedUrl) {
    console.error('[design-image] createSignedUrls:', signError?.message ?? 'no url')
    return NextResponse.json(
      { error: 'Could not generate image URL' },
      { status: 500 }
    )
  }

  return NextResponse.json({ url: signed[0].signedUrl })
}
