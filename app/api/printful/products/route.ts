import { NextResponse } from 'next/server'

const PRINTFUL_BASE = 'https://api.printful.com'

/** Printful Catalog API product (subset we use). */
type PrintfulProduct = {
  id: number
  main_category_id: number
  type: string
  type_name: string
  title: string
  brand: string
  model?: string
  image: string
  variant_count: number
  is_discontinued?: boolean
}

/** Printful category (from Get Categories). */
type PrintfulCategory = {
  id: number
  title: string
  [key: string]: unknown
}

/** Normalized shoe model for the design tool (base model selection). */
export type PrintfulShoeProduct = {
  id: string
  name: string
  image: string
  brand: string
  type_name: string
}

const SHOES_KEYWORDS = ['shoe', 'sneaker', 'footwear', 'canvas', 'slip-on', 'low-top', 'high-top']

function isShoeProduct(p: PrintfulProduct): boolean {
  const t = (p.type_name || p.type || '').toLowerCase()
  const title = (p.title || '').toLowerCase()
  const combined = `${t} ${title}`
  return SHOES_KEYWORDS.some((k) => combined.includes(k))
}

/**
 * GET /api/printful/products
 * Returns Printful catalog products filtered to shoes only.
 * Uses PRINTFUL_API_KEY from env (server-side only).
 */
export async function GET() {
  const apiKey = process.env.PRINTFUL_API_KEY
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: 'Printful API not configured', products: [] },
      { status: 503 }
    )
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
  }

  try {
    // 1) Try to get categories and find shoes category ID
    let categoryIds: number[] = []
    const categoriesRes = await fetch(`${PRINTFUL_BASE}/categories`, { headers })
    if (categoriesRes.ok) {
      const categoriesData = (await categoriesRes.json()) as {
        code?: number
        result?: PrintfulCategory[] | { categories?: PrintfulCategory[] }
      }
      const list: PrintfulCategory[] = Array.isArray(categoriesData.result)
        ? categoriesData.result
        : (categoriesData.result as { categories?: PrintfulCategory[] })?.categories ?? []
      const shoesCategories = list.filter((c) => {
        const title = (c.title || '').toLowerCase()
        return SHOES_KEYWORDS.some((k) => title.includes(k))
      })
      categoryIds = shoesCategories.map((c) => c.id)
    }

    // 2) Fetch products: by category_id if we found any, otherwise all
    let products: PrintfulProduct[] = []
    if (categoryIds.length > 0) {
      const res = await fetch(
        `${PRINTFUL_BASE}/products?category_id=${categoryIds.join(',')}`,
        { headers }
      )
      if (res.ok) {
        const data = (await res.json()) as { code?: number; result?: PrintfulProduct[] }
        products = Array.isArray(data.result) ? data.result : []
      }
    }

    // 3) If no products from category filter, fetch all and filter by type/title
    if (products.length === 0) {
      const res = await fetch(`${PRINTFUL_BASE}/products`, { headers })
      if (!res.ok) {
        const err = await res.text()
        console.error('[api/printful/products]', res.status, err)
        return NextResponse.json(
          { error: 'Printful API error', products: [] },
          { status: 502 }
        )
      }
      const data = (await res.json()) as { code?: number; result?: PrintfulProduct[] }
      const all = Array.isArray(data.result) ? data.result : []
      products = all.filter(isShoeProduct)
    } else {
      // Still filter in case category returned non-shoes
      products = products.filter(isShoeProduct)
    }

    const normalized: PrintfulShoeProduct[] = products.map((p) => ({
      id: String(p.id),
      name: p.title || p.model || `Product ${p.id}`,
      image: p.image || '',
      brand: p.brand || '',
      type_name: p.type_name || p.type || '',
    }))

    return NextResponse.json({ products: normalized })
  } catch (e) {
    console.error('[api/printful/products]', e)
    return NextResponse.json(
      { error: 'Failed to fetch Printful products', products: [] },
      { status: 500 }
    )
  }
}
