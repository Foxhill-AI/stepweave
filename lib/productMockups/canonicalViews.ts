/**
 * Standardized product mockup gallery: one image per canonical camera view,
 * ordered Left → Right → Back → Top (side view leads cards and product detail).
 *
 * Printful returns many overlapping mockups (one set per print placement, plus
 * "extra" angles that repeat across placements). Placement keys describe the
 * PRINT AREA (quarters, tongue…), not the camera angle, so classification uses,
 * in order of reliability:
 *   1. An explicit `view` stored with the mockup (new generations — derived
 *      from the Printful render URL, e.g. "…-white-front-2-6a49….png").
 *   2. The human-readable labels/titles Printful sends:
 *      - "Front 2"             → top-down pair shot (verified across shoe types)
 *      - "Left" / "Left Front" → pair angled left
 *      - "Right" / "Right Front" → pair angled right
 *      - "Back" / "Left Back" / "Right Back" → rear views
 *      - "Branding" / label_inside → inside-label shot, excluded from gallery
 */

export type CanonicalMockupView = 'top' | 'left' | 'right' | 'back' | 'front' | 'branding' | 'other'

/** Minimal shape accepted by the gallery builder (storefront rows and design-tool tabs both fit). */
export type MockupViewSource = {
  placement: string
  label: string
  mockup_url?: string
  /** Explicit canonical view stored at generation time (preferred over text classification). */
  view?: string
  extra_mockups?: Array<{ title: string; mockup_url?: string; view?: string }>
}

export type StandardGalleryImage = {
  view: CanonicalMockupView
  url: string
  /** Display label for alt text, e.g. "Top view" */
  label: string
}

const VIEW_ORDER: CanonicalMockupView[] = ['left', 'right', 'back', 'top']

export const CANONICAL_VIEW_LABELS: Record<CanonicalMockupView, string> = {
  top: 'Top view',
  left: 'Left view',
  right: 'Right view',
  back: 'Back view',
  front: 'Front view',
  branding: 'Branding',
  other: 'Product view',
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const VALID_VIEWS = new Set<string>(['top', 'left', 'right', 'back', 'front', 'branding', 'other'])

function asCanonicalView(value: string | undefined): CanonicalMockupView | null {
  const v = (value ?? '').trim().toLowerCase()
  return VALID_VIEWS.has(v) ? (v as CanonicalMockupView) : null
}

/**
 * Derive the camera view from a Printful mockup render URL. Printful filenames
 * end with the view slug followed by a hex id, e.g.
 * "mens-high-top-canvas-shoes-white-front-2-6a49d34909be0.png".
 * Matching is anchored to the end so product-name words ("high-top") don't
 * trigger false positives. Returns null when no known view token is found.
 */
export function viewHintFromPrintfulUrl(url: string): CanonicalMockupView | null {
  const file = url.split('?')[0].split('/').pop()?.toLowerCase() ?? ''
  if (!file) return null
  const stem = file
    .replace(/\.[a-z0-9]+$/, '') // extension
    .replace(/-[0-9a-f]{8,}$/, '') // trailing render id
  // Check compound tokens before simple ones ("front-2" before "front", etc.)
  const checks: Array<[string, CanonicalMockupView]> = [
    ['front-2', 'top'],
    ['left-back', 'back'],
    ['right-back', 'back'],
    ['left-front', 'left'],
    ['left-inside', 'left'],
    ['left-outside', 'left'],
    ['right-front', 'right'],
    ['right-inside', 'right'],
    ['right-outside', 'right'],
    ['back', 'back'],
    ['left', 'left'],
    ['right', 'right'],
    ['top', 'top'],
    ['branding', 'branding'],
    ['label', 'branding'],
    ['front', 'front'],
  ]
  for (const [token, view] of checks) {
    if (stem === token || stem.endsWith(`-${token}`)) return view
  }
  return null
}

/**
 * Classify a mockup by its placement/label/title text.
 * `score` ranks candidates within the same view — lower is preferred.
 */
export function classifyMockupView(text: string): { view: CanonicalMockupView; score: number } {
  const t = norm(text)
  if (!t) return { view: 'other', score: 9 }
  if (t.includes('brand') || t.includes('label inside')) return { view: 'branding', score: 0 }

  const left = /\bleft\b/.test(t)
  const right = /\bright\b/.test(t)
  const back = /\bback\b/.test(t)
  const front = /\bfront\b/.test(t)

  if (/\btop\b/.test(t)) return { view: 'top', score: 1 }
  // Printful titles the top-down pair shot "Front 2"
  if (/\bfront 2\b/.test(t)) return { view: 'top', score: 1 }

  if (back) {
    if (!left && !right) return { view: 'back', score: 1 }
    return { view: 'back', score: left ? 2 : 3 }
  }

  if (left && !right) {
    if (t === 'left') return { view: 'left', score: 1 }
    if (front) return { view: 'left', score: 2 }
    if (t.includes('quarter')) return { view: 'left', score: 3 }
    if (t.includes('tongue')) return { view: 'left', score: 5 }
    return { view: 'left', score: 4 }
  }

  if (right && !left) {
    if (t === 'right') return { view: 'right', score: 1 }
    if (front) return { view: 'right', score: 2 }
    if (t.includes('quarter')) return { view: 'right', score: 3 }
    if (t.includes('tongue')) return { view: 'right', score: 5 }
    return { view: 'right', score: 4 }
  }

  if (front) return { view: 'front', score: 1 }
  return { view: 'other', score: 9 }
}

type Candidate = {
  view: CanonicalMockupView
  score: number
  order: number
  url: string
}

/**
 * Build the standardized gallery from placement rows (signed URLs already resolved).
 * Picks the best image per canonical view (top, left, right, back), skipping
 * branding shots and never reusing the same image URL twice. A front view fills
 * the top slot when no true top view exists. Falls back to the raw non-branding
 * images if nothing could be classified (legacy data).
 */
export function buildStandardMockupGallery(
  placements: MockupViewSource[]
): StandardGalleryImage[] {
  const candidates: Candidate[] = []
  let order = 0

  const push = (url: string | undefined, explicitView: string | undefined, text: string) => {
    const u = url?.trim()
    if (!u) return
    const explicit = asCanonicalView(explicitView)
    if (explicit) {
      candidates.push({ view: explicit, score: 0, order: order++, url: u })
    } else {
      const { view, score } = classifyMockupView(text)
      candidates.push({ view, score, order: order++, url: u })
    }
  }

  for (const p of placements) {
    push(p.mockup_url, p.view, `${p.placement} ${p.label}`)
    for (const ex of p.extra_mockups ?? []) {
      push(ex.mockup_url, ex.view, ex.title ?? '')
    }
  }

  const usedUrls = new Set<string>()
  const images: StandardGalleryImage[] = []

  const pickBest = (view: CanonicalMockupView) =>
    candidates
      .filter((c) => c.view === view && !usedUrls.has(c.url))
      .sort((a, b) => (a.score !== b.score ? a.score - b.score : a.order - b.order))[0]

  for (const view of VIEW_ORDER) {
    let best = pickBest(view)
    // No true top-down shot → a straight-on front view is the closest substitute
    if (!best && view === 'top') best = pickBest('front')
    if (best) {
      usedUrls.add(best.url)
      images.push({ view: best.view, url: best.url, label: CANONICAL_VIEW_LABELS[best.view] })
    }
  }

  if (images.length > 0) return images

  // Legacy fallback: nothing matched the canonical views — show non-branding
  // candidates in original order, deduped by URL.
  for (const c of candidates) {
    if (c.view === 'branding' || usedUrls.has(c.url)) continue
    usedUrls.add(c.url)
    images.push({ view: c.view, url: c.url, label: CANONICAL_VIEW_LABELS[c.view] })
  }
  return images
}
