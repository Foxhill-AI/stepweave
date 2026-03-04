import { NextResponse } from 'next/server'
import { getActiveProducts, getFeaturedCreatorsForHero } from '@/lib/supabaseClient'

/**
 * GET /api/home-products
 * Fetches products and featured creators on the server so the home page doesn't
 * depend on the browser Supabase client (which can hang with createBrowserClient).
 */
export async function GET() {
  console.log("SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("HAS_ANON_KEY:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  try {
    const [products, featuredCreators] = await Promise.all([
      getActiveProducts(),
      getFeaturedCreatorsForHero(),
    ])
    return NextResponse.json({ products, featuredCreators })
  } catch (e) {
    console.error('[api/home-products]', e)
    return NextResponse.json(
      { products: [], featuredCreators: [] },
      { status: 200 }
    )
  }
}
