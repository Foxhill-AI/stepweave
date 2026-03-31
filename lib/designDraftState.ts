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
// Per-placement images: each placement tab can carry multiple image layers.
// Stored in design_state as:
//   { pattern_images: { left: [{ id, path, s, dx, dy }, …], right: […] } }
// ---------------------------------------------------------------------------

/** One image layer within a placement — stores both the storage path and its transform. */
export type PlacementImageLayer = {
  id: string
  path: string  // Supabase storage path (private bucket)
  s: number     // scale (0.05–1)
  dx: number    // x offset from center in printfile pixels
  dy: number    // y offset from center in printfile pixels
}

/** Same as PlacementImageLayer but with the signed URL resolved for display. */
export type ResolvedPlacementImageLayer = PlacementImageLayer & {
  signedUrl?: string | null
}

/** Per-placement layers keyed by Printful placement name. */
export type PlacementImagesState = Record<string, PlacementImageLayer[]>

const PATTERN_IMAGES_KEY = 'pattern_images'

function parseLayer(v: unknown): PlacementImageLayer | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.path !== 'string' || !o.path.trim()) return null
  return {
    id: typeof o.id === 'string' && o.id.trim() ? o.id : crypto.randomUUID(),
    path: o.path,
    s: typeof o.s === 'number' && o.s > 0 && o.s <= 1 ? o.s : 1,
    dx: typeof o.dx === 'number' ? o.dx : 0,
    dy: typeof o.dy === 'number' ? o.dy : 0,
  }
}

/**
 * Parse design_state.pattern_images.
 * Handles both legacy string values and new array-of-layers format.
 */
export function parsePlacementImages(raw: unknown): PlacementImagesState {
  if (!raw || typeof raw !== 'object') return {}
  const block = (raw as Record<string, unknown>)[PATTERN_IMAGES_KEY]
  if (!block || typeof block !== 'object') return {}
  const out: PlacementImagesState = {}
  for (const [placement, v] of Object.entries(block)) {
    if (Array.isArray(v)) {
      const layers = v.map(parseLayer).filter((l): l is PlacementImageLayer => l !== null)
      if (layers.length) out[placement] = layers
    } else if (typeof v === 'string' && v.trim()) {
      // Legacy single-string format → wrap as single layer
      out[placement] = [{ id: 'legacy', path: v, s: 1, dx: 0, dy: 0 }]
    }
  }
  return out
}

/** Merge per-placement layers into full design_state, preserving other keys. */
export function mergePlacementImagesIntoDesignState(
  designState: Record<string, unknown>,
  images: PlacementImagesState
): Record<string, unknown> {
  return { ...designState, [PATTERN_IMAGES_KEY]: images }
}

/** Return a new state with a new layer appended to the given placement. */
export function addPlacementImageLayer(
  current: PlacementImagesState,
  placement: string,
  layer: PlacementImageLayer
): PlacementImagesState {
  return { ...current, [placement]: [...(current[placement] ?? []), layer] }
}

/** Return a new state with a specific layer's transform updated. */
export function updatePlacementImageLayer(
  current: PlacementImagesState,
  placement: string,
  layerId: string,
  patch: Partial<Pick<PlacementImageLayer, 's' | 'dx' | 'dy'>>
): PlacementImagesState {
  const layers = (current[placement] ?? []).map((l) =>
    l.id === layerId ? { ...l, ...patch } : l
  )
  return { ...current, [placement]: layers }
}

/** Return a new state with a specific layer removed from the given placement. */
export function removePlacementImageLayer(
  current: PlacementImagesState,
  placement: string,
  layerId: string
): PlacementImagesState {
  const layers = (current[placement] ?? []).filter((l) => l.id !== layerId)
  const next = { ...current }
  if (layers.length > 0) next[placement] = layers
  else delete next[placement]
  return next
}

// Keep legacy exports for callers that haven't migrated yet
/** @deprecated Use addPlacementImageLayer */
export function updatePlacementImage(
  current: PlacementImagesState,
  placement: string,
  path: string
): PlacementImagesState {
  const layer: PlacementImageLayer = { id: crypto.randomUUID(), path, s: 1, dx: 0, dy: 0 }
  return addPlacementImageLayer(current, placement, layer)
}

/** @deprecated Use removePlacementImageLayer with a specific layerId */
export function removePlacementImage(
  current: PlacementImagesState,
  placement: string
): PlacementImagesState {
  const next = { ...current }
  delete next[placement]
  return next
}
