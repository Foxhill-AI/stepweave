/**
 * Tier-based marketplace fee structure. Server-only; not exposed to the client.
 *
 * Creator share applies to the PROFIT MARGIN (sale price − Printful base cost),
 * not to the full sale price. The floor price (MVP) is the same for all tiers —
 * it only needs to cover Printful + Stripe + buffer.
 *
 * Example: shoes at $80, Printful cost $50 → margin $30
 *   free    (15% share) → creator gets $4.50,  platform keeps $75.50 (covers $50 Printful)
 *   starter (50% share) → creator gets $15.00, platform keeps $65.00
 *   pro     (90% share) → creator gets $27.00, platform keeps $53.00
 */

/** Creator's share of the sale price, by subscription tier. */
export const CREATOR_SHARE_BY_TIER: Record<string, number> = {
  free: 0.15,
  starter: 0.50,
  pro: 0.90,
}

export function getCreatorShareRate(tier: string | null | undefined): number {
  return CREATOR_SHARE_BY_TIER[tier ?? 'free'] ?? CREATOR_SHARE_BY_TIER.free
}

/**
 * Platform fee in basis points (100 = 1%) for the given subscription tier.
 * free=8500, starter=5000, pro=1000.
 */
export function getPlatformFeeBpsByTier(tier: string | null | undefined): number {
  const share = getCreatorShareRate(tier)
  return Math.round((1 - share) * 10000)
}

/**
 * Legacy: fixed fee from PLATFORM_FEE_BPS env var (default 8500 = free tier).
 * Use getPlatformFeeBpsByTier for per-seller rates.
 */
export function getPlatformFeeBps(): number {
  const raw = process.env.PLATFORM_FEE_BPS?.trim()
  if (!raw) return getPlatformFeeBpsByTier('free')
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0 || n > 10000) return getPlatformFeeBpsByTier('free')
  return n
}

// Must stay in sync with lib/printful/pricingEstimate.ts constants.
const STRIPE_RATE = 0.029          // 2.9% Stripe processing fee
const PLATFORM_BUFFER_RATE = 0.05  // 5% platform reserve

/**
 * Margin-based split: creator receives their tier% of the net margin.
 *
 * Net margin = what's left after Stripe's percentage fee and the platform buffer
 * are deducted from revenue, and Printful fulfillment cost is subtracted.
 *   margin = subtotal × (1 − STRIPE_RATE − PLATFORM_BUFFER_RATE) − baseCostTotal
 *
 * At the minimum viable price the margin is ≈ 0, so creator earns ~$0.
 * Any price above floor generates positive margin that creator shares in.
 *
 * Note: Stripe's $0.30 fixed fee is per-transaction (not per line item) so it
 * is excluded here; the platform buffer already provides a conservative reserve.
 *
 * @param subtotal        Line subtotal (unit_price × quantity)
 * @param baseCostTotal   Printful fulfillment cost for this line (base_cost × quantity)
 * @param creatorShareRate From getCreatorShareRate(tier), e.g. 0.15 / 0.50 / 0.90
 */
export function splitLineByMargin(
  subtotal: number,
  baseCostTotal: number,
  creatorShareRate: number
): { platformFeeAmount: number; sellerNetAmount: number; effectiveFeeBps: number } {
  const safeSub = Math.max(0, subtotal)
  const safeCost = Math.max(0, baseCostTotal)

  // Net revenue after Stripe rate and platform buffer, minus Printful cost.
  const netRevenue = safeSub * (1 - STRIPE_RATE - PLATFORM_BUFFER_RATE)
  const margin = Math.max(0, netRevenue - safeCost)

  const sellerNetCents = Math.round(margin * creatorShareRate * 100)
  const sellerNetAmount = sellerNetCents / 100
  const platformFeeAmount = Math.round((safeSub - sellerNetAmount) * 100) / 100

  // Effective platform fee bps on full subtotal (for record-keeping in order_item).
  const effectiveFeeBps = safeSub > 0 ? Math.round((platformFeeAmount / safeSub) * 10000) : 10000

  return { platformFeeAmount, sellerNetAmount, effectiveFeeBps }
}

/** @deprecated Use splitLineByMargin for new code. Kept for backwards compatibility. */
export function splitLineSubtotal(
  subtotal: number,
  bps: number
): { platformFeeAmount: number; sellerNetAmount: number } {
  if (!(subtotal > 0) || !(bps >= 0)) {
    return { platformFeeAmount: 0, sellerNetAmount: Math.max(0, subtotal) }
  }
  const subCents = Math.round(subtotal * 100)
  const feeCents = Math.min(subCents, Math.round((subCents * bps) / 10000))
  const netCents = subCents - feeCents
  return {
    platformFeeAmount: feeCents / 100,
    sellerNetAmount: netCents / 100,
  }
}
