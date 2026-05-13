import { PRINTFUL_BASE } from '@/lib/printful/mockupTask'

export type PrintfulPricingRecipient = {
  address1: string
  city: string
  state_code: string
  country_code: string
  zip: string
}

export type PricingEstimateLine = {
  key: string
  label: string
  amount: number
  detail?: string
}

/** Stripe standard processing: 2.9% + $0.30 per transaction */
export const STRIPE_RATE = 0.029
export const STRIPE_FIXED = 0.30
/** Platform buffer withheld to protect margin: 5% of sale price */
export const PLATFORM_BUFFER_RATE = 0.05

export type PricingEstimateOk = {
  ok: true
  currency: string
  /** Line items shown in the breakdown (fulfillment + shipping — no tax). */
  lines: PricingEstimateLine[]
  /** Fulfillment + shipping: what Printful charges per sale. */
  baseCosts: number
  /** Lowest price where all costs (Printful + Stripe + buffer) are covered.
   *  Derived algebraically: (baseCosts + STRIPE_FIXED) / (1 - STRIPE_RATE - PLATFORM_BUFFER_RATE) */
  minimumViablePrice: number
  shippingServiceName: string | null
  note: string
}

export type PricingEstimateResult = PricingEstimateOk | { ok: false; error: string }

export function parsePrintfulMoney(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value)
  if (typeof value === 'string') {
    const n = parseFloat(value)
    return Number.isFinite(n) ? Math.max(0, n) : 0
  }
  return 0
}

/**
 * Estimated listing economics from Printful catalog variant price + shipping.
 * Tax is intentionally excluded — real sales tax is collected at checkout.
 */
export async function estimatePrintfulListingCosts(params: {
  apiKey: string
  storeId: string
  productId: string
  variantId: number
  quantity?: number
  recipient: PrintfulPricingRecipient
}): Promise<PricingEstimateResult> {
  const { apiKey, storeId, productId, variantId, quantity = 1, recipient } = params

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    'X-PF-Store-Id': storeId.trim(),
  }

  const productRes = await fetch(`${PRINTFUL_BASE}/products/${encodeURIComponent(productId)}`, {
    headers,
  })
  if (!productRes.ok) {
    const t = await productRes.text().catch(() => '')
    console.error('[pricingEstimate] catalog', productRes.status, t.slice(0, 400))
    return { ok: false, error: 'Failed to load Printful catalog product.' }
  }

  const productJson = (await productRes.json()) as {
    code?: number
    result?: {
      product?: Record<string, unknown> & { currency?: string; variants?: unknown[] }
      variants?: Array<Record<string, unknown> & { id?: number; price?: string }>
    }
  }

  if (productJson.code !== 200 || !productJson.result) {
    return { ok: false, error: 'Invalid Printful catalog response.' }
  }

  const result = productJson.result
  const product = result.product ?? {}
  const variants =
    (Array.isArray(result.variants) ? result.variants : null) ??
    (Array.isArray(product.variants) ? (product.variants as Array<Record<string, unknown>>) : []) ??
    []

  const variant = variants.find((v) => Number(v.id) === variantId)
  if (!variant) {
    return { ok: false, error: 'Variant not found for this product.' }
  }

  const currency = String(product.currency ?? 'USD').trim() || 'USD'
  const fulfillment = parsePrintfulMoney(variant.price)

  const shipBody = {
    recipient: {
      address1: recipient.address1,
      city: recipient.city,
      state_code: recipient.state_code,
      country_code: recipient.country_code,
      zip: recipient.zip,
    },
    items: [{ variant_id: variantId, quantity }],
    currency,
    locale: 'en_US',
  }

  let shippingCost = 0
  let shippingServiceName: string | null = null

  const shipRes = await fetch(`${PRINTFUL_BASE}/shipping/rates`, {
    method: 'POST',
    headers,
    body: JSON.stringify(shipBody),
  })
  const shipText = await shipRes.text()
  let shipParsed: { code?: number; result?: Array<{ id?: string; name?: string; rate?: string }> }
  try {
    shipParsed = JSON.parse(shipText) as typeof shipParsed
  } catch {
    shipParsed = {}
  }

  if (shipRes.ok && shipParsed.code === 200 && Array.isArray(shipParsed.result) && shipParsed.result.length > 0) {
    const standard =
      shipParsed.result.find((r) => String(r.id).toUpperCase() === 'STANDARD') ?? shipParsed.result[0]
    shippingCost = parsePrintfulMoney(standard?.rate)
    shippingServiceName = String(standard?.name ?? standard?.id ?? '').trim() || null
  } else {
    console.warn('[pricingEstimate] shipping/rates', shipRes.status, shipText.slice(0, 300))
  }

  const baseCosts = Math.round((fulfillment + shippingCost) * 100) / 100

  // Minimum viable price: solve for P where margin = 0
  //   P - baseCosts - (P * STRIPE_RATE + STRIPE_FIXED) - P * PLATFORM_BUFFER_RATE = 0
  //   P * (1 - STRIPE_RATE - PLATFORM_BUFFER_RATE) = baseCosts + STRIPE_FIXED
  //   P = (baseCosts + STRIPE_FIXED) / (1 - STRIPE_RATE - PLATFORM_BUFFER_RATE)
  const denominator = 1 - STRIPE_RATE - PLATFORM_BUFFER_RATE
  const minimumViablePrice = Math.ceil(((baseCosts + STRIPE_FIXED) / denominator) * 100) / 100

  const lines: PricingEstimateLine[] = [
    {
      key: 'fulfillment',
      label: 'Base product & print',
      amount: fulfillment,
    },
    {
      key: 'shipping',
      label: 'Shipping',
      amount: shippingCost,
    },
  ]

  const note =
    'Estimates from Printful. Final fulfillment costs may vary by design complexity. Sales tax is collected from buyers at checkout.'

  return {
    ok: true,
    currency,
    lines,
    baseCosts,
    minimumViablePrice,
    shippingServiceName,
    note,
  }
}
