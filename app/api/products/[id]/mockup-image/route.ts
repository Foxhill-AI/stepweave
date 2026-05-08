import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { pickPrimaryMockupUrl } from '@/lib/printful/pickPrimaryMockupForCard'

type MockupPlacement = {
  placement: string
  label: string
  mockup_url: string
  extra_mockups?: Array<{ title: string; mockup_url: string }>
}

/**
 * GET /api/products/[id]/mockup-image
 * Returns the best single Printful mockup URL for the product (item cards).
 * Priority: left shoe → left shoe quarter → other left views → rest (see pickPrimaryMockupUrl).
 * Public for active products; owner-only for drafts.
 * design_draft is queried with service-role client to bypass RLS.
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
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const supabase = await createServerSupabaseClient()
  const { data: product, error: productError } = await supabase
    .from('product')
    .select('id, user_account_id, status, updated_at')
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

  /** Always use stored mockups for storefront thumbnails (shoe photos), not only when “fresh” vs product.updated_at — stale mockups beat showing the flat pattern art. */
  const placements = (draft?.mockup_urls ?? []) as MockupPlacement[]
  const url = pickPrimaryMockupUrl(placements)

  return NextResponse.json({ url: url ?? null })
}
