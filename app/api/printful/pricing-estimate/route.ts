import { NextRequest, NextResponse } from 'next/server'
import { estimatePrintfulListingCosts } from '@/lib/printful/pricingEstimate'

/**
 * POST /api/printful/pricing-estimate
 * Body: { productId: string, variantId: number, quantity?: number }
 * Returns catalog fulfillment + shipping costs + minimum viable price.
 * Tax is intentionally excluded — collected from buyers at checkout.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.PRINTFUL_API_KEY?.trim()
  const storeId = process.env.PRINTFUL_STORE_ID?.trim()
  if (!apiKey || !storeId) {
    return NextResponse.json({ error: 'Printful API not configured' }, { status: 503 })
  }

  let body: { productId?: string; variantId?: unknown; quantity?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const productId = typeof body.productId === 'string' ? body.productId.trim() : ''
  const variantRaw = body.variantId
  const variantId =
    typeof variantRaw === 'number'
      ? variantRaw
      : typeof variantRaw === 'string' && /^\d+$/.test(variantRaw)
        ? parseInt(variantRaw, 10)
        : NaN

  if (!productId || !Number.isFinite(variantId)) {
    return NextResponse.json(
      { error: 'productId (string) and variantId (number) are required' },
      { status: 400 }
    )
  }

  const qtyRaw = body.quantity
  const q =
    typeof qtyRaw === 'number'
      ? qtyRaw
      : typeof qtyRaw === 'string' && /^\d+$/.test(qtyRaw)
        ? parseInt(qtyRaw, 10)
        : 1
  const quantity = Math.max(1, Math.min(99, Math.floor(Number.isFinite(q) ? q : 1)))

  const zip = process.env.PRINTFUL_PRICING_SHIP_ZIP?.trim() || '90001'
  const city = process.env.PRINTFUL_PRICING_SHIP_CITY?.trim() || 'Los Angeles'
  const state = process.env.PRINTFUL_PRICING_SHIP_STATE?.trim() || 'CA'
  const country = process.env.PRINTFUL_PRICING_SHIP_COUNTRY?.trim() || 'US'
  const address1 = process.env.PRINTFUL_PRICING_SHIP_ADDRESS1?.trim() || '100 Main St'

  const result = await estimatePrintfulListingCosts({
    apiKey,
    storeId,
    productId,
    variantId,
    quantity,
    recipient: { address1, city, state_code: state, country_code: country, zip },
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json(result)
}
