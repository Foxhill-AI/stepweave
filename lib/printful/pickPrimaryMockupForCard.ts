/**
 * Choose the best Printful mockup URL for product cards / primary hero image.
 * Prefers a true side camera (left, then right) via the canonical gallery so we
 * do not accidentally pick top-down "Front 2" shots that sit on left_* placements.
 */

import { buildStandardMockupGallery } from '@/lib/productMockups/canonicalViews'

export type MockupPlacementRow = {
  placement: string
  label: string
  mockup_url: string
  view?: string
  extra_mockups?: Array<{ title: string; mockup_url: string; view?: string }>
}

function norm(s: string): string {
  return s.toLowerCase().replace(/_/g, ' ').trim()
}

function isBrandingTitle(title: string): boolean {
  return norm(title).includes('brand')
}

/** Lower rank = shown first (legacy text ranking; kept for tests / fallbacks). */
export function rankMockupCandidate(searchText: string): number {
  const t = norm(searchText)
  if (t.includes('brand')) return 100

  const left = /\bleft\b/.test(t) || t.startsWith('left ')
  const right = /\bright\b/.test(t)
  const shoe = t.includes('shoe')
  const quarter = t.includes('quarter')

  if (left && shoe && !quarter && !right) return 0
  if ((t === 'left' || t.startsWith('left ')) && !quarter && !right && !shoe) return 0
  if (left && shoe && quarter) return 1
  if (left && quarter) return 1
  if (left && !right) return 2
  if (right && shoe) return 4
  if (right) return 5

  return 8
}

/**
 * Prefer canonical left/right side views; fall back to any non-top gallery image,
 * then any gallery image, then the first placement mockup_url.
 */
export function pickPrimaryMockupUrl(placements: MockupPlacementRow[]): string | null {
  const gallery = buildStandardMockupGallery(placements)
  const side =
    gallery.find((g) => g.view === 'left') ??
    gallery.find((g) => g.view === 'right')
  if (side?.url?.trim()) return side.url.trim()

  const nonTop = gallery.find((g) => g.view !== 'top')
  if (nonTop?.url?.trim()) return nonTop.url.trim()

  if (gallery[0]?.url?.trim()) return gallery[0].url.trim()

  for (const p of placements) {
    const main = p.mockup_url?.trim()
    if (main) return main
    for (const ex of p.extra_mockups ?? []) {
      if (!ex.mockup_url?.trim()) continue
      if (isBrandingTitle(ex.title ?? '')) continue
      return ex.mockup_url.trim()
    }
  }

  return null
}
