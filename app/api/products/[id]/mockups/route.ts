import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { buildStandardMockupGallery } from '@/lib/productMockups/canonicalViews'
import {
  resolveMockupPlacementsForDisplay,
  type StoredMockupPlacement,
} from '@/lib/productMockups/storage'

export type MockupImageEntry = {
  url: string
  alt: string
}

/**
 * GET /api/products/[id]/mockups[?gender=womens]
 * Returns the standardized mockup gallery for a product.
 *
 * Optional ?gender=womens query param returns the womens gallery.
 * If womens mockups have not been generated yet, falls back to mens silently.
 * Response includes `womens_mockups_available: boolean` so the client knows
 * whether womens images actually exist.
 *
 * Public for active products; owner-only for drafts.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const productId = Number(id)
  if (Number.isNaN(productId)) {
    return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
  }

  const requestedGender = request.nextUrl.searchParams.get('gender') === 'womens' ? 'womens' : 'mens'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const supabase = await createServerSupabaseClient()
  const { data: product, error: productError } = await supabase
    .from('product')
    .select('id, user_account_id, status, name, updated_at')
    .eq('id', productId)
    .maybeSingle()
  if (productError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const isActive = product.status === 'active'
  if (!isActive) {
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

  const { data: draft } = await admin
    .from('design_draft')
    .select('mockup_urls, mockups_generated_at')
    .eq('final_product_id', productId)
    .maybeSingle()

  const allPlacements = (draft?.mockup_urls ?? []) as StoredMockupPlacement[]
  const productName = (product as { name: string }).name

  // Determine which placements to serve.
  // Legacy entries (no gender field) are treated as mens.
  const mensPlacements = allPlacements.filter((p) => !p.gender || p.gender === 'mens')
  const womensPlacements = allPlacements.filter((p) => p.gender === 'womens')
  const womensAvailable = womensPlacements.length > 0

  let rawPlacements: StoredMockupPlacement[]
  if (requestedGender === 'womens' && womensAvailable) {
    rawPlacements = womensPlacements
  } else {
    // Default or fallback: use mens.
    rawPlacements = mensPlacements.length > 0 ? mensPlacements : allPlacements
  }

  const resolvedPlacements = await resolveMockupPlacementsForDisplay(admin, rawPlacements)

  const images: MockupImageEntry[] = buildStandardMockupGallery(resolvedPlacements).map(
    (img) => ({ url: img.url, alt: `${productName} — ${img.label}` })
  )

  return NextResponse.json({ images, womens_mockups_available: womensAvailable })
}
