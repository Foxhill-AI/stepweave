import { NextResponse } from 'next/server'
import { getPopularProductsWithEngagement } from '@/lib/supabaseClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Explore / “View more” for Most Popular — ranked by likes + saves across all users. */
export async function GET() {
  try {
    const { products, engagementByProductId } = await getPopularProductsWithEngagement(48)
    return NextResponse.json({ products, popularEngagement: engagementByProductId })
  } catch (e) {
    console.error('[api/most-popular-products]', e)
    return NextResponse.json({ products: [], popularEngagement: {} }, { status: 200 })
  }
}
