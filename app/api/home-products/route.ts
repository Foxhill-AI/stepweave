import { NextResponse } from 'next/server'
import { getActiveProducts, buildFeaturedCreatorsFromProductRows } from '@/lib/supabaseClient'

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
    const products = await getActiveProducts()
    const featuredCreators = await buildFeaturedCreatorsFromProductRows(products)
    return NextResponse.json({ products, featuredCreators })
  } catch (e) {
    console.error('[api/home-products]', e)
    return NextResponse.json(
      { products: [], featuredCreators: [] },
      { status: 200 }
    )
  }
}
