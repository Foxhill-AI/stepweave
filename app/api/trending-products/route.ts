import { NextResponse } from 'next/server'
import { getActiveProductsSortedByViews } from '@/lib/supabaseClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Explore “Trending Now” — all active products, view count desc (same as home / marketplace). */
export async function GET() {
  try {
    const { products, viewsByProductId } =
      await getActiveProductsSortedByViews()
    const viewsByProductIdJson: Record<string, number> = {}
    for (const [id, n] of Object.entries(viewsByProductId)) {
      viewsByProductIdJson[String(id)] = n
    }
    return NextResponse.json({ products, viewsByProductId: viewsByProductIdJson })
  } catch (e) {
    console.error('[api/trending-products]', e)
    return NextResponse.json({ products: [], viewsByProductId: {} }, { status: 200 })
  }
}
