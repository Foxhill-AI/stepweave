/**
 * Fixed marketplace fee (Phase 2). Rate from PLATFORM_FEE_BPS (basis points: 100 = 1%).
 * Server-only; not exposed to the client.
 */

const DEFAULT_BPS = 1500

export function getPlatformFeeBps(): number {
  const raw = process.env.PLATFORM_FEE_BPS?.trim()
  if (!raw) return DEFAULT_BPS
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0 || n > 10000) return DEFAULT_BPS
  return n
}

/** Split one line's subtotal into platform fee and seller net (USD,2 decimal places via cents). */
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
