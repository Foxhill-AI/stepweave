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

export type PricingEstimateOk = {
  ok: true
  currency: string
  lines: PricingEstimateLine[]
  subtotalBeforeTax: number
  taxRate: number
  taxAmount: number
  totalCost: number
  marginRate: number
  recommendedMinimum: number
  shippingServiceName: string | null
  note: string
  /** Where shipping was estimated to (for UI copy). */
  recipientSummary: string
  /** Shown under base cost — standard print is in catalog price. */
  printScopeNote: string
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
 * Estimated listing economics from Printful catalog variant price + shipping/rates.
 * Tax and margin are applied in USD terms on top of API amounts (same currency Printful returns for the store).
 */
export async function estimatePrintfulListingCosts(params: {
  apiKey: string
  storeId: string
  productId: string
  variantId: number
  quantity?: number
  recipient: PrintfulPricingRecipient
  taxRate: number
  marginRate: number
}): Promise<PricingEstimateResult> {
  const { apiKey, storeId, productId, variantId, quantity = 1, recipient, taxRate, marginRate } =
    params

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

  const printScopeNote =
    'Standard print area is included in the catalog line. Extra techniques or placements may add cost on the real order.'

  const lines: PricingEstimateLine[] = [
    {
      key: 'fulfillment',
      label: 'Base product & print (Printful catalog)',
      amount: fulfillment,
      detail: 'Standard fulfillment cost for this variant.',
    },
    {
      key: 'shipping',
      label: 'Shipping (estimated)',
      amount: shippingCost,
      detail:
        shippingServiceName ??
        (shippingCost > 0 ? undefined : 'Unavailable for this request; check Printful dashboard.'),
    },
  ]

  const subtotalBeforeTax = fulfillment + shippingCost
  const taxAmount = Math.round(subtotalBeforeTax * taxRate * 100) / 100
  lines.push({
    key: 'tax',
    label: `Estimated taxes (${Math.round(taxRate * 100)}%)`,
    amount: taxAmount,
    detail: 'Applied to fulfillment + shipping as a planning estimate.',
  })

  const totalCost = Math.round((subtotalBeforeTax + taxAmount) * 100) / 100
  const recommendedMinimum = Math.ceil(totalCost * (1 + marginRate) * 100) / 100

  const recipientSummary = `${recipient.city}, ${recipient.state_code} ${recipient.zip} (${recipient.country_code})`

  const note =
    'Estimates from Printful. Final costs may vary by destination, real taxes, and design complexity.'

  return {
    ok: true,
    currency,
    lines,
    subtotalBeforeTax,
    taxRate,
    taxAmount,
    totalCost,
    marginRate,
    recommendedMinimum,
    shippingServiceName,
    note,
    recipientSummary,
    printScopeNote,
  }
}
