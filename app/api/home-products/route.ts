import { NextResponse } from 'next/server'
import {
  getActiveProducts,
  buildFeaturedCreatorsFromProductRows,
  getPopularProductsWithEngagement,
} from '@/lib/supabaseClient'
import { MARKETPLACE_SHOES_CATEGORY_SLUG } from '@/lib/marketplaceConfig'

/** Always fresh data so new publishes show on the homepage without stale cache. */
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/home-products
 * Fetches products and featured creators on the server so the home page doesn't
 * depend on the browser Supabase client (which can hang with createBrowserClient).
 * Hero sections are derived from the same product list as the carousels.
 */
export async function GET() {
  try {
    const [products, popular] = await Promise.all([
      getActiveProducts(MARKETPLACE_SHOES_CATEGORY_SLUG),
      getPopularProductsWithEngagement(12),
    ])
    const popularProducts = popular.products.filter((product) =>
      product.product_category?.some(
        (pc) => pc.category?.slug === MARKETPLACE_SHOES_CATEGORY_SLUG
      )
    )
    const popularEngagement = Object.fromEntries(
      Object.entries(popular.engagementByProductId).filter(([productId]) =>
        popularProducts.some((product) => String(product.id) === productId)
      )
    )
    const featuredCreators = await buildFeaturedCreatorsFromProductRows(products)
    return NextResponse.json({
      products,
      featuredCreators,
      popularProducts,
      popularEngagement,
    })
  } catch (e) {
    console.error('[api/home-products]', e)
    return NextResponse.json(
      { products: [], featuredCreators: [], popularProducts: [], popularEngagement: {} },
      { status: 200 }
    )
  }
}
