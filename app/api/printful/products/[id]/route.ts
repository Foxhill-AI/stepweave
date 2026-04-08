import { NextRequest, NextResponse } from 'next/server'

const PRINTFUL_BASE = 'https://api.printful.com'

/** Product from Printful Get Product response. */
type PrintfulProductDetail = {
  id: number
  title?: string
  model?: string
  image?: string
  variant_count?: number
  variants?: Array<{ id: number; product_id: number; image?: string; color?: string }>
  [key: string]: unknown
}

/** Response shape: images by view. When API only provides one image, we use it for all views. */
export type ProductViewImages = {
  front: string
  back: string
  right: string
  left: string
}

export type PrintfulProductVariantSummary = {
  id: number
  name: string
  color: string
  size: string
  image: string
  /** Printful catalog wholesale/fulfillment price string (e.g. "29.50"), if present. */
  catalogPrice: string | null
}

export type PrintfulProductByIdResponse = {
  id: string
  name: string
  image: string
  imagesByView: ProductViewImages
  /** ISO currency for catalog prices (e.g. USD, EUR). */
  currency: string
  /** Catalog variants for mockup variant_id selection. */
  variants: PrintfulProductVariantSummary[]
}

/**
 * GET /api/printful/products/[id]
 * Returns a single Printful catalog product by id for the design tool preview.
 * Provides one image per view (front, back, right, left). When the catalog
 * only has one image, the same URL is used for all views.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const productId = id?.trim()
  if (!productId) {
    return NextResponse.json({ error: 'Product id required' }, { status: 400 })
  }

  const apiKey = process.env.PRINTFUL_API_KEY
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: 'Printful API not configured' },
      { status: 503 }
    )
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
  }

  try {
    const res = await fetch(`${PRINTFUL_BASE}/products/${productId}`, { headers })
    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      const err = await res.text()
      console.error('[api/printful/products/[id]]', res.status, err)
      return NextResponse.json(
        { error: 'Failed to fetch product' },
        { status: 502 }
      )
    }

    const data = (await res.json()) as {
      code?: number
      result?: { product?: PrintfulProductDetail; variants?: PrintfulProductDetail['variants'] }
    }
    const result = data.result
    const product = result?.product
    const variants = result?.variants ?? product?.variants ?? []

    // Use a single reference image for ALL views so the same product variant (color) is shown.
    // The catalog gives one product image and per-variant images; we must not mix variants
    // (e.g. variant[0]=white, variant[1]=black) across Front/Back/Right/Left.
    const mainImage = (product?.image ?? '').trim()
    const firstVariantImage = variants.length > 0 ? (variants[0]?.image ?? '').trim() : ''
    const referenceImage = mainImage || firstVariantImage || ''

    const imagesByView: ProductViewImages = {
      front: referenceImage,
      back: referenceImage,
      right: referenceImage,
      left: referenceImage,
    }

    const productCurrency = String((product as { currency?: string })?.currency ?? 'USD').trim() || 'USD'

    const variantSummaries: PrintfulProductVariantSummary[] = variants.map((v) => {
      const rawPrice = (v as { price?: string }).price
      const catalogPrice =
        typeof rawPrice === 'string' && rawPrice.trim() !== '' ? rawPrice.trim() : null
      return {
        id: v.id,
        name: (v as { name?: string }).name ?? `Variant ${v.id}`,
        color: (v.color as string) ?? '',
        size: (v as { size?: string }).size ?? '',
        image: ((v.image as string) ?? '').trim(),
        catalogPrice,
      }
    })

    const response: PrintfulProductByIdResponse = {
      id: String(product?.id ?? productId),
      name: product?.title || product?.model || `Product ${productId}`,
      image: referenceImage,
      imagesByView,
      currency: productCurrency,
      variants: variantSummaries,
    }

    return NextResponse.json(response)
  } catch (e) {
    console.error('[api/printful/products/[id]]', e)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}
