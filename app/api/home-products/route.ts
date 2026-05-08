import { NextResponse } from 'next/server'
import {
  getActiveProductsSortedByViews,
  buildFeaturedCreatorsFromProductRows,
  getPopularProductsWithEngagementForCategory,
} from '@/lib/supabaseClient'
import {
  isListingNewWithinDays,
  mergeBrandNewStrip,
  sortProductRowsNewestFirst,
} from '@/lib/productsForHome'

/** Enough rows for homepage “View more” pagination without refetching. */
const HOME_POPULAR_LIMIT = 500
const HOME_BRAND_NEW_STRIP_MAX = 80

/** Always fresh data so new publishes show on the homepage without stale cache. */
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/home-products
 * Fetches **all** active products (no category filter) and featured creators.
 * Hero sections use the same rows as Trending (view-sorted).
 */
export async function GET() {
  try {
    const [{ products, viewsByProductId }, popular] = await Promise.all([
      getActiveProductsSortedByViews(),
      getPopularProductsWithEngagementForCategory(undefined, HOME_POPULAR_LIMIT),
    ])
    const popularProducts = popular.products
    const popularEngagement = popular.engagementByProductId
    const featuredCreators = await buildFeaturedCreatorsFromProductRows(products)
    const viewsByProductIdJson: Record<string, number> = {}
    for (const [id, n] of Object.entries(viewsByProductId)) {
      viewsByProductIdJson[String(id)] = n
    }
    const latestSorted = sortProductRowsNewestFirst(products)
    const brandNewProducts = mergeBrandNewStrip(
      latestSorted.filter((r) => isListingNewWithinDays(r, 7)),
      latestSorted,
      HOME_BRAND_NEW_STRIP_MAX
    )
    const latestArrivalProducts = latestSorted.slice(0, 12)
    return NextResponse.json({
      products,
      viewsByProductId: viewsByProductIdJson,
      brandNewProducts,
      latestArrivalProducts,
      featuredCreators,
      popularProducts,
      popularEngagement,
    })
  } catch (e) {
    console.error('[api/home-products]', e)
    return NextResponse.json(
      {
        products: [],
        viewsByProductId: {},
        brandNewProducts: [],
        latestArrivalProducts: [],
        featuredCreators: [],
        popularProducts: [],
        popularEngagement: {},
      },
      { status: 200 }
    )
  }
}
