import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type MockupPlacement = {
  placement: string
  label: string
  mockup_url: string
  extra_mockups?: Array<{ title: string; mockup_url: string }>
}

export type MockupImageEntry = {
  url: string
  alt: string
}

function isBranding(title: string): boolean {
  return title.toLowerCase().includes('brand')
}

/**
 * GET /api/products/[id]/mockups
 * Returns all available Printful mockup images for a product as a flat ordered list,
 * suitable for the product gallery. Branding extra_mockups are excluded.
 * Main placement mockups come first (right > left > others), then extras per placement.
 * Public for active products; owner-only for drafts.
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
    .select('id, user_account_id, status, name')
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
    .select('mockup_urls')
    .eq('final_product_id', productId)
    .maybeSingle()

  const rawPlacements = (draft?.mockup_urls ?? []) as MockupPlacement[]
  const productName = (product as { name: string }).name

  // Sort placements: left first, left_quarter second, right third, rest after
  const sorted = [...rawPlacements].sort((a, b) => {
    const rank = (p: MockupPlacement) =>
      p.placement === 'left' ? 0
      : p.placement === 'left_quarter' ? 1
      : p.placement.startsWith('left') ? 2
      : p.placement === 'right' ? 3
      : p.placement.startsWith('right') ? 4
      : 5
    return rank(a) - rank(b)
  })

  const images: MockupImageEntry[] = []
  for (const p of sorted) {
    if (p.mockup_url?.trim()) {
      images.push({ url: p.mockup_url, alt: `${productName} — ${p.label}` })
    }
    for (const extra of p.extra_mockups ?? []) {
      if (extra.mockup_url?.trim() && !isBranding(extra.title ?? '')) {
        images.push({ url: extra.mockup_url, alt: `${productName} — ${extra.title}` })
      }
    }
  }

  return NextResponse.json({ images })
}
