/**
 * Fixed per-model pricing config.
 * Prices are set by the platform — creators do not choose their own prices.
 *
 * baseCosts = Printful fulfillment + shipping (used for creator margin calc).
 * minimumViablePrice = floor that covers baseCosts + Stripe fees + 5% platform buffer.
 * fixedPrice = the actual listing price customers pay.
 *
 * To update: re-run /api/admin/pricing-report, adjust fixedPrice, update baseCosts/mvp
 * if Printful's fulfillment costs have drifted.
 */

export type ModelPricing = {
  productId: string
  name: string
  fixedPrice: number
  /** Printful fulfillment + standard shipping to US */
  baseCosts: number
  minimumViablePrice: number
}

export const MODEL_PRICING: ModelPricing[] = [
  // ── Athletic ────────────────────────────────────────────────────────────
  { productId: '657', name: "Men's Athletic Shoes",      fixedPrice: 70.99, baseCosts: 52.13, minimumViablePrice: 56.93 },
  { productId: '658', name: "Women's Athletic Shoes",    fixedPrice: 70.99, baseCosts: 52.13, minimumViablePrice: 56.93 },
  // ── High Top Canvas ─────────────────────────────────────────────────────
  { productId: '513', name: "Men's High Top Canvas Shoes",   fixedPrice: 72.99, baseCosts: 53.15, minimumViablePrice: 58.04 },
  { productId: '525', name: "Women's High Top Canvas Shoes", fixedPrice: 72.99, baseCosts: 53.15, minimumViablePrice: 58.04 },
  // ── Lace-Up Canvas ──────────────────────────────────────────────────────
  { productId: '578', name: "Men's Lace-Up Canvas Shoes",    fixedPrice: 70.99, baseCosts: 52.13, minimumViablePrice: 56.93 },
  { productId: '579', name: "Women's Lace-Up Canvas Shoes",  fixedPrice: 70.99, baseCosts: 52.13, minimumViablePrice: 56.93 },
  // ── Slip-On Canvas ──────────────────────────────────────────────────────
  { productId: '574', name: "Men's Slip-On Canvas Shoes",    fixedPrice: 58.99, baseCosts: 51.11, minimumViablePrice: 55.82 },
  { productId: '575', name: "Women's Slip-On Canvas Shoes",  fixedPrice: 58.99, baseCosts: 51.11, minimumViablePrice: 55.82 },
  // ── Slides ──────────────────────────────────────────────────────────────
  { productId: '597', name: "Men's Slides",    fixedPrice: 58.99, baseCosts: 42.44, minimumViablePrice: 46.41 },
  { productId: '598', name: "Women's Slides",  fixedPrice: 58.99, baseCosts: 42.44, minimumViablePrice: 46.41 },
]

const _byId = new Map(MODEL_PRICING.map((m) => [m.productId, m]))

export function getModelPricing(productId: string | null | undefined): ModelPricing | null {
  if (!productId) return null
  return _byId.get(String(productId).trim()) ?? null
}
