/**
 * Typed slices of design_draft.design_state for Printful editor + preview.
 * Keep backward-compatible: unknown keys are preserved when merging.
 */

/** Printful Mockup Generator `position` object (pixels). */
export type PrintfulPosition = {
  area_width: number
  area_height: number
  width: number
  height: number
  top: number
  left: number
}

/**
 * Compact per-placement transform stored in design_state (easier UI than 6 numbers).
 * s = scale of artwork within print area (0–1], dx/dy = extra offset in px from centered position.
 */
export type PlacementCompactTransform = {
  s: number
  dx: number
  dy: number
}

export type PrintfulPlacementsState = Record<string, PlacementCompactTransform>

const PLACEMENTS_KEY = 'printful_placements'

export function parsePrintfulPlacements(raw: unknown): PrintfulPlacementsState {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const block = o[PLACEMENTS_KEY]
  if (!block || typeof block !== 'object') return {}
  const out: PrintfulPlacementsState = {}
  for (const [k, v] of Object.entries(block)) {
    if (!v || typeof v !== 'object') continue
    const t = v as Record<string, unknown>
    const s = typeof t.s === 'number' && t.s > 0 && t.s <= 1 ? t.s : 1
    const dx = typeof t.dx === 'number' ? t.dx : 0
    const dy = typeof t.dy === 'number' ? t.dy : 0
    out[k] = { s, dx, dy }
  }
  return out
}

export function compactToPrintfulPosition(
  areaWidth: number,
  areaHeight: number,
  t: PlacementCompactTransform
): PrintfulPosition {
  const s = Math.min(1, Math.max(0.05, t.s))
  const width = Math.max(1, Math.round(areaWidth * s))
  const height = Math.max(1, Math.round(areaHeight * s))
  const left = Math.round((areaWidth - width) / 2 + t.dx)
  const top = Math.round((areaHeight - height) / 2 + t.dy)
  return {
    area_width: areaWidth,
    area_height: areaHeight,
    width,
    height,
    top,
    left,
  }
}

/**
 * Keep artwork fully inside the print area (Printful position constraints).
 */
export function clampCompactTransformInArea(
  areaWidth: number,
  areaHeight: number,
  t: PlacementCompactTransform
): PlacementCompactTransform {
  const s = Math.min(1, Math.max(0.05, t.s))
  const w = areaWidth * s
  const h = areaHeight * s
  const maxDx = Math.max(0, (areaWidth - w) / 2)
  const maxDy = Math.max(0, (areaHeight - h) / 2)
  const dx = Math.min(maxDx, Math.max(-maxDx, t.dx))
  const dy = Math.min(maxDy, Math.max(-maxDy, t.dy))
  return { s, dx, dy }
}

/** Merge a patch then clamp so the box stays inside the print area. */
export function mergeAndClampPlacement(
  areaWidth: number,
  areaHeight: number,
  prev: PlacementCompactTransform,
  patch: Partial<PlacementCompactTransform>
): PlacementCompactTransform {
  return clampCompactTransformInArea(areaWidth, areaHeight, {
    s: patch.s ?? prev.s,
    dx: patch.dx ?? prev.dx,
    dy: patch.dy ?? prev.dy,
  })
}

/** Merge placement transforms into full design_state object. */
export function mergePrintfulPlacementsIntoDesignState(
  designState: Record<string, unknown>,
  placements: PrintfulPlacementsState
): Record<string, unknown> {
  return {
    ...designState,
    [PLACEMENTS_KEY]: placements,
  }
}

export function updatePlacementTransform(
  current: PrintfulPlacementsState,
  placement: string,
  patch: Partial<PlacementCompactTransform>
): PrintfulPlacementsState {
  const prev = current[placement] ?? { s: 1, dx: 0, dy: 0 }
  return {
    ...current,
    [placement]: {
      s: patch.s ?? prev.s,
      dx: patch.dx ?? prev.dx,
      dy: patch.dy ?? prev.dy,
    },
  }
}

export const DESIGN_STATE_KEYS = {
  printfulPlacements: PLACEMENTS_KEY,
} as const

// ---------------------------------------------------------------------------
// Per-placement images: each placement tab can carry its own pattern image.
// Stored in design_state as { pattern_images: { left: 'path', right: 'path', … } }
// ---------------------------------------------------------------------------

/** Storage paths (private bucket) keyed by Printful placement name. */
export type PlacementImagesState = Record<string, string>

const PATTERN_IMAGES_KEY = 'pattern_images'

/** Parse design_state.pattern_images → { placement: storagePath }. */
export function parsePlacementImages(raw: unknown): PlacementImagesState {
  if (!raw || typeof raw !== 'object') return {}
  const block = (raw as Record<string, unknown>)[PATTERN_IMAGES_KEY]
  if (!block || typeof block !== 'object') return {}
  const out: PlacementImagesState = {}
  for (const [k, v] of Object.entries(block)) {
    if (typeof v === 'string' && v.trim()) out[k] = v
  }
  return out
}

/** Merge per-placement images into full design_state, preserving other keys. */
export function mergePlacementImagesIntoDesignState(
  designState: Record<string, unknown>,
  images: PlacementImagesState
): Record<string, unknown> {
  return { ...designState, [PATTERN_IMAGES_KEY]: images }
}

/** Return a new state with the given placement's image path added/updated. */
export function updatePlacementImage(
  current: PlacementImagesState,
  placement: string,
  path: string
): PlacementImagesState {
  return { ...current, [placement]: path }
}

/** Return a new state with the given placement's image removed. */
export function removePlacementImage(
  current: PlacementImagesState,
  placement: string
): PlacementImagesState {
  const next = { ...current }
  delete next[placement]
  return next
}
