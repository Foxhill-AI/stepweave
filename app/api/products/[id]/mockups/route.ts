import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  compareMockupPlacementsForGallery,
  pickPrimaryMockupUrl,
} from '@/lib/printful/pickPrimaryMockupForCard'
import { areProductMockupsFresh } from '@/lib/printful/productMockupsFresh'

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
 * Placement order matches item-card priority (left shoe first, then left shoe quarter, etc.).
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

  const productUpdatedAt = product.updated_at as string | undefined
  const mockupsGeneratedAt = draft?.mockups_generated_at as string | null | undefined
  const rawPlacements = (
    draft && areProductMockupsFresh(productUpdatedAt, mockupsGeneratedAt ?? null)
      ? draft.mockup_urls ?? []
      : []
  ) as MockupPlacement[]
  const productName = (product as { name: string }).name

  const cardPrimaryUrl = pickPrimaryMockupUrl(rawPlacements)

  const sorted = [...rawPlacements].sort(compareMockupPlacementsForGallery)

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

  if (cardPrimaryUrl?.trim() && images.length > 0) {
    const idx = images.findIndex((i) => i.url === cardPrimaryUrl.trim())
    if (idx > 0) {
      const [lead] = images.splice(idx, 1)
      images.unshift(lead)
    }
  }

  return NextResponse.json({ images })
}
