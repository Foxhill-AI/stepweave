/**
 * Choose the best Printful mockup URL for product cards / primary hero image.
 * Priority: "left shoe" (not quarter) → "left shoe quarter" → other left → rest.
 */

export type MockupPlacementRow = {
  placement: string
  label: string
  mockup_url: string
  extra_mockups?: Array<{ title: string; mockup_url: string }>
}

function norm(s: string): string {
  return s.toLowerCase().replace(/_/g, ' ').trim()
}

function isBrandingTitle(title: string): boolean {
  return norm(title).includes('brand')
}

/** Lower rank = shown first (card primary, gallery lead). */
export function rankMockupCandidate(searchText: string): number {
  const t = norm(searchText)
  if (t.includes('brand')) return 100

  const left = /\bleft\b/.test(t) || t.startsWith('left ')
  const right = /\bright\b/.test(t)
  const shoe = t.includes('shoe')
  const quarter = t.includes('quarter')

  // 0: left shoe view, not the quarter angle
  if (left && shoe && !quarter && !right) return 0
  // Exact API keys sometimes used without "shoe" in label
  if ((t === 'left' || t.startsWith('left ')) && !quarter && !right && !shoe) return 0

  // 1: left shoe quarter (fallback requested by product)
  if (left && shoe && quarter) return 1
  if (left && quarter) return 1

  // 2: other left-side views
  if (left && !right) return 2

  if (right && shoe) return 4
  if (right) return 5

  return 8
}

type Candidate = { url: string; rank: number; order: number }

/**
 * Flatten main + non-branding extra mockups into scored candidates.
 */
export function pickPrimaryMockupUrl(placements: MockupPlacementRow[]): string | null {
  const candidates: Candidate[] = []
  let order = 0

  const push = (url: string, textParts: string[]) => {
    const text = textParts.filter(Boolean).join(' ')
    const rank = rankMockupCandidate(text)
    if (rank >= 100) return
    const u = url.trim()
    if (!u) return
    candidates.push({ url: u, rank, order: order++ })
  }

  for (const p of placements) {
    const pl = norm(p.placement)
    const lb = norm(p.label)
    if (p.mockup_url?.trim()) {
      push(p.mockup_url, [pl, lb])
    }
    for (const ex of p.extra_mockups ?? []) {
      if (!ex.mockup_url?.trim()) continue
      if (isBrandingTitle(ex.title ?? '')) continue
      push(ex.mockup_url, [pl, lb, norm(ex.title ?? '')])
    }
  }

  if (candidates.length === 0) {
    const first = placements.find((p) => p.mockup_url?.trim())
    return first?.mockup_url?.trim() ?? null
  }

  candidates.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    return a.order - b.order
  })

  return candidates[0].url
}

/** Sort placement rows for gallery: same priority as card, then stable. */
export function compareMockupPlacementsForGallery(a: MockupPlacementRow, b: MockupPlacementRow): number {
  const rankA = rankMockupCandidate(`${a.placement} ${a.label}`)
  const rankB = rankMockupCandidate(`${b.placement} ${b.label}`)
  if (rankA !== rankB) return rankA - rankB
  return norm(a.placement).localeCompare(norm(b.placement))
}
