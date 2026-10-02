import { NextRequest, NextResponse } from 'next/server'
import { parsePrintfulMoney, STRIPE_RATE, STRIPE_FIXED, PLATFORM_BUFFER_RATE } from '@/lib/printful/pricingEstimate'

const PRINTFUL_BASE = 'https://api.printful.com'

const FOOTWEAR_KEYWORDS = ['shoe', 'shoes', 'sneaker', 'sneakers', 'footwear']
const EXCLUDED_PRODUCT_TERMS = [
  't-shirt', 'hoodie', 'sweatshirt', 'tank top', 'canvas (in)', 'framed canvas',
  'thin canvas', 'tee', 'raglan', 'one piece', 'pullover', 'cropped', 'muscle shirt',
  'long sleeve', 'short sleeve', 'sweatpants', 'garment-dyed', 'oversized', 'v-neck',
  'eco t-shirt', 'baby ', 'toddler ', 'youth ',
]

/** Recipient used for shipping rate estimates (default US address). */
const ESTIMATE_RECIPIENT = {
  address1: '1 Infinite Loop',
  city: 'Cupertino',
  state_code: 'CA',
  country_code: 'US',
  zip: '95014',
}

function isShoeProduct(p: { type_name?: string; type?: string; title?: string }): boolean {
  const typeName = (p.type_name || p.type || '').toLowerCase()
  const title = (p.title || '').toLowerCase()
  const combined = `${typeName} ${title}`
  if (!FOOTWEAR_KEYWORDS.some((k) => combined.includes(k))) return false
  if (EXCLUDED_PRODUCT_TERMS.some((term) => combined.includes(term))) return false
  return true
}

function calcMinViablePrice(baseCosts: number): number {
  const denominator = 1 - STRIPE_RATE - PLATFORM_BUFFER_RATE
  return Math.ceil(((baseCosts + STRIPE_FIXED) / denominator) * 100) / 100
}

/**
 * GET /api/admin/pricing-report
 *
 * Returns all Printful shoe models with:
 *  - All variant prices grouped by color (one representative size per color)
 *  - Shipping estimate to a standard US address
 *  - Calculated minimumViablePrice per variant
 *
 * Protected by x-admin-secret header.
 */
export async function GET(request: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET?.trim()
  if (adminSecret) {
    const provided = request.headers.get('x-admin-secret')
    if (provided !== adminSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const apiKey = process.env.PRINTFUL_API_KEY?.trim()
  const storeId = process.env.PRINTFUL_STORE_ID?.trim()
  if (!apiKey || !storeId) {
    return NextResponse.json({ error: 'Printful env vars not configured' }, { status: 500 })
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-PF-Store-Id': storeId,
  }

  // 1. Fetch all products and filter to shoes
  const productsRes = await fetch(`${PRINTFUL_BASE}/products`, { headers })
  if (!productsRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch Printful products' }, { status: 502 })
  }
  const productsData = (await productsRes.json()) as {
    result?: Array<{ id: number; title?: string; type?: string; type_name?: string; brand?: string; image?: string }>
  }
  const allProducts = Array.isArray(productsData.result) ? productsData.result : []
  const shoeProducts = allProducts.filter(isShoeProduct)

  if (shoeProducts.length === 0) {
    return NextResponse.json({ models: [], note: 'No shoe products found in Printful catalog.' })
  }

  // 2. For each shoe model, fetch variants and compute pricing
  const models = []

  for (const product of shoeProducts) {
    const variantRes = await fetch(`${PRINTFUL_BASE}/products/${product.id}`, { headers })
    if (!variantRes.ok) {
      models.push({ id: product.id, name: product.title, error: `HTTP ${variantRes.status}` })
      continue
    }
    const variantData = (await variantRes.json()) as {
      code?: number
      result?: {
        product?: { currency?: string }
        variants?: Array<{
          id: number
          name?: string
          size?: string
          color?: string
          price?: string | number
          availability_status?: string
          in_stock?: boolean
        }>
      }
    }

    if (variantData.code !== 200 || !variantData.result) {
      models.push({ id: product.id, name: product.title, error: 'Invalid response' })
      continue
    }

    const currency = String(variantData.result.product?.currency ?? 'USD')
    const variants = variantData.result.variants ?? []

    // Group by color — pick one size per color to avoid redundant shipping calls
    const colorMap = new Map<string, { variantId: number; size: string; fulfillmentCost: number }>()
    for (const v of variants) {
      const color = (v.color ?? 'Unknown').trim()
      if (!colorMap.has(color)) {
        colorMap.set(color, {
          variantId: v.id,
          size: v.size ?? '',
          fulfillmentCost: parsePrintfulMoney(v.price),
        })
      }
    }

    // Get all unique fulfillment prices (one per color)
    const colorEntries = Array.from(colorMap.entries())

    // Fetch shipping for the first variant (shipping cost is the same regardless of color)
    const firstVariantId = colorEntries[0]?.[1]?.variantId
    let shippingCost = 0
    let shippingServiceName: string | null = null

    if (firstVariantId) {
      const shipBody = {
        recipient: ESTIMATE_RECIPIENT,
        items: [{ variant_id: firstVariantId, quantity: 1 }],
        currency,
        locale: 'en_US',
      }
      try {
        const shipRes = await fetch(`${PRINTFUL_BASE}/shipping/rates`, {
          method: 'POST',
          headers,
          body: JSON.stringify(shipBody),
        })
        const shipText = await shipRes.text()
        let shipParsed: { code?: number; result?: Array<{ id?: string; name?: string; rate?: string }> } = {}
        try { shipParsed = JSON.parse(shipText) } catch { /* ignore */ }

        if (shipRes.ok && shipParsed.code === 200 && Array.isArray(shipParsed.result) && shipParsed.result.length > 0) {
          const standard =
            shipParsed.result.find((r) => String(r.id).toUpperCase() === 'STANDARD') ??
            shipParsed.result[0]
          shippingCost = parsePrintfulMoney(standard?.rate)
          shippingServiceName = String(standard?.name ?? standard?.id ?? '').trim() || null
        }
      } catch {
        // shipping estimate failed — continue without it
      }
    }

    // Build per-color pricing rows
    const colorPricing = colorEntries.map(([color, { variantId, size: repSize, fulfillmentCost }]) => {
      const baseCosts = Math.round((fulfillmentCost + shippingCost) * 100) / 100
      return {
        color,
        representativeVariantId: variantId,
        representativeSize: repSize,
        fulfillmentCost: Math.round(fulfillmentCost * 100) / 100,
        shippingCost: Math.round(shippingCost * 100) / 100,
        baseCosts,
        minimumViablePrice: calcMinViablePrice(baseCosts),
      }
    })

    // Also compute aggregate: min/max minimumViablePrice across all colors
    const mvpValues = colorPricing.map((c) => c.minimumViablePrice)
    const mvpMin = Math.min(...mvpValues)
    const mvpMax = Math.max(...mvpValues)

    // All unique fulfillment prices across all variants (all sizes, all colors)
    const allVariantPrices = variants.map((v) => ({
      variantId: v.id,
      name: v.name ?? '',
      size: v.size ?? '',
      color: v.color ?? '',
      fulfillmentCost: parsePrintfulMoney(v.price),
    }))

    models.push({
      productId: product.id,
      name: product.title ?? `Product ${product.id}`,
      brand: product.brand ?? '',
      currency,
      shippingCost: Math.round(shippingCost * 100) / 100,
      shippingService: shippingServiceName,
      colorCount: colorMap.size,
      mvpRange:
        mvpMin === mvpMax
          ? `$${mvpMin.toFixed(2)}`
          : `$${mvpMin.toFixed(2)} – $${mvpMax.toFixed(2)}`,
      colorPricing,
      allVariantPrices,
    })
  }

  return NextResponse.json({ models, estimateRecipient: ESTIMATE_RECIPIENT, currency: 'USD' })
}
