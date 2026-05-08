import { NextResponse } from 'next/server'
import { getPopularProductsWithEngagementForCategory } from '@/lib/supabaseClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Explore / “View more” for Most Popular — all-time likes + saves (desc). */
export async function GET() {
  try {
    const { products, engagementByProductId } =
      await getPopularProductsWithEngagementForCategory(undefined, 50_000)
    return NextResponse.json({ products, popularEngagement: engagementByProductId })
  } catch (e) {
    console.error('[api/most-popular-products]', e)
    return NextResponse.json({ products: [], popularEngagement: {} }, { status: 200 })
  }
}
