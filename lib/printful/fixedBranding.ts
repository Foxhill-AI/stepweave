/**
 * Step Weave tongue/label mark — always applied to Printful branding placements.
 * Clients do not choose this artwork; mockups and orders force this asset.
 */

/** Public path under `/public` (browser-relative). */
export const STEPWEAVE_BRANDING_PUBLIC_PATH = '/branding/branding-rect-stacked.png'

/** Stable layer id when showing the fixed mark in the design-tool canvas. */
export const STEPWEAVE_BRANDING_LAYER_ID = 'stepweave-fixed-branding'

/**
 * True for Printful placement keys that are the inside brand / label print area
 * (not a side/quarter print area).
 */
export function isFixedBrandingPlacement(placement: string): boolean {
  const t = placement.toLowerCase().replace(/_/g, ' ').trim()
  if (!t) return false
  if (t.includes('brand')) return true
  if (t === 'label' || t.includes('label inside')) return true
  return false
}

/** Drop branding/label keys from a placement list (e.g. when applying a user pattern). */
export function excludeFixedBrandingPlacements(placements: string[]): string[] {
  return placements.filter((p) => !isFixedBrandingPlacement(p))
}

/**
 * Absolute URL Printful can fetch. Uses NEXT_PUBLIC_SITE_URL / VERCEL_URL when set.
 * Returns null if no public origin is configured (local-only without site URL).
 */
export function getFixedBrandingAbsoluteUrl(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  const vercel = process.env.VERCEL_URL?.trim()
  const base =
    fromEnv ||
    (vercel
      ? vercel.startsWith('http')
        ? vercel.replace(/\/$/, '')
        : `https://${vercel.replace(/\/$/, '')}`
      : '')
  if (!base) return null
  return `${base}${STEPWEAVE_BRANDING_PUBLIC_PATH}`
}
