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

// ── Unified model pricing (mens + womens paired) ────────────────────────────
// base_model_id on design_draft is always the mens product ID.
// Womens partner is derived from here at publish / mockup-generation time.

export type UnifiedModelPricing = {
  productIdMens: string
  productIdWomens: string
  /** Display name without gender prefix, e.g. "Athletic Shoes" */
  name: string
  fixedPrice: number
  baseCosts: number
  minimumViablePrice: number
}

export const UNIFIED_MODEL_PRICING: UnifiedModelPricing[] = [
  { productIdMens: '657', productIdWomens: '658', name: 'Athletic Shoes',        fixedPrice: 70.99, baseCosts: 52.13, minimumViablePrice: 56.93 },
  { productIdMens: '513', productIdWomens: '525', name: 'High Top Canvas Shoes', fixedPrice: 72.99, baseCosts: 53.15, minimumViablePrice: 58.04 },
  { productIdMens: '578', productIdWomens: '579', name: 'Lace-Up Canvas Shoes',  fixedPrice: 70.99, baseCosts: 52.13, minimumViablePrice: 56.93 },
  { productIdMens: '574', productIdWomens: '575', name: 'Slip-On Canvas Shoes',  fixedPrice: 58.99, baseCosts: 51.11, minimumViablePrice: 55.82 },
  { productIdMens: '597', productIdWomens: '598', name: 'Slides',                fixedPrice: 58.99, baseCosts: 42.44, minimumViablePrice: 46.41 },
]

const _unifiedByMensId = new Map(UNIFIED_MODEL_PRICING.map((m) => [m.productIdMens, m]))
const _unifiedByWomensId = new Map(UNIFIED_MODEL_PRICING.map((m) => [m.productIdWomens, m]))

export function getUnifiedModelPricingByMensId(id: string | null | undefined): UnifiedModelPricing | null {
  if (!id) return null
  return _unifiedByMensId.get(String(id).trim()) ?? null
}

export function getUnifiedModelPricingByWomensId(id: string | null | undefined): UnifiedModelPricing | null {
  if (!id) return null
  return _unifiedByWomensId.get(String(id).trim()) ?? null
}

export function getUnifiedModelPricingByEitherId(id: string | null | undefined): UnifiedModelPricing | null {
  if (!id) return null
  const s = String(id).trim()
  return _unifiedByMensId.get(s) ?? _unifiedByWomensId.get(s) ?? null
}
