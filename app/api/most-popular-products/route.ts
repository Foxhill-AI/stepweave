import { NextResponse } from 'next/server'
import { getPopularProductsWithEngagement } from '@/lib/supabaseClient'
import { MARKETPLACE_SHOES_CATEGORY_SLUG } from '@/lib/marketplaceConfig'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Explore / “View more” for Most Popular — ranked by likes + saves across all users. */
export async function GET() {
  try {
    const { products, engagementByProductId } = await getPopularProductsWithEngagement(48)
    const filtered = products.filter((product) =>
      product.product_category?.some(
        (pc) => pc.category?.slug === MARKETPLACE_SHOES_CATEGORY_SLUG
      )
    )
    const popularEngagement = Object.fromEntries(
      Object.entries(engagementByProductId).filter(([productId]) =>
        filtered.some((product) => String(product.id) === productId)
      )
    )
    return NextResponse.json({ products: filtered, popularEngagement })
  } catch (e) {
    console.error('[api/most-popular-products]', e)
    return NextResponse.json({ products: [], popularEngagement: {} }, { status: 200 })
  }
}
