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
  /** When both set, Printful position uses these sizes (printfile px) instead of s × area */
  width?: number
  height?: number
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
    const width = typeof t.width === 'number' && t.width > 0 ? t.width : undefined
    const height = typeof t.height === 'number' && t.height > 0 ? t.height : undefined
    out[k] = { s, dx, dy, width, height }
  }
  return out
}

export function compactToPrintfulPosition(
  areaWidth: number,
  areaHeight: number,
  t: PlacementCompactTransform
): PrintfulPosition {
  let width: number
  let height: number
  if (t.width != null && t.height != null && t.width > 0 && t.height > 0) {
    width = Math.max(1, Math.round(t.width))
    height = Math.max(1, Math.round(t.height))
  } else {
    const s = Math.min(1, Math.max(0.05, t.s))
    width = Math.max(1, Math.round(areaWidth * s))
    height = Math.max(1, Math.round(areaHeight * s))
  }
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
  let w: number
  let h: number
  if (t.width != null && t.height != null && t.width > 0 && t.height > 0) {
    w = t.width
    h = t.height
  } else {
    w = areaWidth * s
    h = areaHeight * s
  }
  const maxDx = Math.max(0, (areaWidth - w) / 2)
  const maxDy = Math.max(0, (areaHeight - h) / 2)
  const dx = Math.min(maxDx, Math.max(-maxDx, t.dx))
  const dy = Math.min(maxDy, Math.max(-maxDy, t.dy))
  return { s, dx, dy, width: t.width, height: t.height }
}

/**
 * Absolute anchor (center of text) in printfile pixels, clamped so glyphs stay inside the canvas.
 * Must match `lib/printful/compositeImages.ts` (renderTextToBuffer).
 */
export function clampTextAnchorInPrintfile(
  w: number,
  h: number,
  x: number,
  y: number,
  fontSize: number
): { x: number; y: number } {
  const rawPad = Math.max(4, Math.ceil(fontSize * 0.55))
  const pad = Math.min(rawPad, Math.max(0, Math.floor(w / 2) - 1), Math.max(0, Math.floor(h / 2) - 1))
  const px = pad > 0 ? Math.max(pad, Math.min(w - pad, x)) : w / 2
  const py = pad > 0 ? Math.max(pad, Math.min(h - pad, y)) : h / 2
  return { x: px, y: py }
}

/**
 * Compact text offsets (dx/dy from center) clamped to the same bounds as server composites.
 */
export function clampTextDxDyInPrintArea(
  areaWidth: number,
  areaHeight: number,
  dx: number,
  dy: number,
  fontSize: number
): { dx: number; dy: number } {
  const w = Math.max(1, Math.round(areaWidth))
  const h = Math.max(1, Math.round(areaHeight))
  const c = clampTextAnchorInPrintfile(w, h, w / 2 + dx, h / 2 + dy, fontSize)
  return { dx: c.x - w / 2, dy: c.y - h / 2 }
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
    width: patch.width ?? prev.width,
    height: patch.height ?? prev.height,
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
      width: patch.width ?? prev.width,
      height: patch.height ?? prev.height,
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
  path: string // Supabase storage path (private bucket)
  /** Uniform scale vs print area (legacy); ignored when `w` and `h` are set */
  s: number
  /** Explicit size in printfile px (optional; takes precedence over s-derived box) */
  w?: number
  h?: number
  dx: number
  dy: number
  /** Degrees, clockwise */
  rotation?: number
}

/** Same as PlacementImageLayer but with the signed URL resolved for display. */
export type ResolvedPlacementImageLayer = PlacementImageLayer & {
  signedUrl?: string | null
}

/** One text layer within a placement. */
export type PlacementTextLayer = {
  id: string
  type: 'text'
  text: string
  fontFamily: string // Font value from lib/fonts.ts
  fontSize: number // Font size in printfile pixels
  color: string // CSS color string, e.g. '#ffffff'
  dx: number
  dy: number
  /** Degrees, clockwise */
  rotation?: number
}

/** Resolved text layer — same structure (no async resolution needed). */
export type ResolvedPlacementTextLayer = PlacementTextLayer

/** Union of all layer types. */
export type PlacementLayer = PlacementImageLayer | PlacementTextLayer

/** Union of resolved layer types (image with signedUrl, text as-is). */
export type ResolvedPlacementLayer = ResolvedPlacementImageLayer | ResolvedPlacementTextLayer

/** Patch type accepted by onLayerChange for any layer. */
export type PlacementLayerPatch = Partial<{
  s: number
  w: number
  h: number
  dx: number
  dy: number
  rotation: number
  fontSize: number
  text: string
  fontFamily: string
  color: string
}>

export function isTextLayer(l: PlacementLayer): l is PlacementTextLayer {
  return (l as PlacementTextLayer).type === 'text'
}

export function isImageLayer(l: PlacementLayer): l is PlacementImageLayer {
  return (l as PlacementTextLayer).type !== 'text'
}

/** Printfile pixel size for an image layer (`w`/`h` override or legacy `s` box). */
export function getImageLayerDimensions(
  layer: Pick<PlacementImageLayer, 's' | 'w' | 'h'>,
  areaWidth: number,
  areaHeight: number
): { w: number; h: number } {
  if (typeof layer.w === 'number' && typeof layer.h === 'number' && layer.w > 0 && layer.h > 0) {
    return { w: Math.round(layer.w), h: Math.round(layer.h) }
  }
  const s = Math.min(1, Math.max(0.05, layer.s))
  return {
    w: Math.max(1, Math.round(areaWidth * s)),
    h: Math.max(1, Math.round(areaHeight * s)),
  }
}

function clampCenteredRectInPrintArea(
  areaWidth: number,
  areaHeight: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  rotationDeg: number
): { cx: number; cy: number } {
  const rot = (rotationDeg * Math.PI) / 180
  const hw = w / 2
  const hh = h / 2
  const cos = Math.abs(Math.cos(rot))
  const sin = Math.abs(Math.sin(rot))
  const halfW = hw * cos + hh * sin
  const halfH = hw * sin + hh * cos
  const ncx = Math.min(areaWidth - halfW, Math.max(halfW, cx))
  const ncy = Math.min(areaHeight - halfH, Math.max(halfH, cy))
  return { cx: ncx, cy: ncy }
}

export function clampImageLayerDxDy(
  areaWidth: number,
  areaHeight: number,
  layer: Pick<PlacementImageLayer, 's' | 'w' | 'h' | 'dx' | 'dy' | 'rotation'>
): { dx: number; dy: number } {
  const { w, h } = getImageLayerDimensions(layer, areaWidth, areaHeight)
  const cx = areaWidth / 2 + layer.dx
  const cy = areaHeight / 2 + layer.dy
  const c = clampCenteredRectInPrintArea(areaWidth, areaHeight, cx, cy, w, h, layer.rotation ?? 0)
  return { dx: c.cx - areaWidth / 2, dy: c.cy - areaHeight / 2 }
}

/** Rough bbox for single-line text (editor Moveable + clamp). */
export function estimateTextLayerBox(text: string, fontSize: number): { w: number; h: number } {
  const ch = Math.max(1, (text || ' ').length)
  const w = Math.max(Math.ceil(fontSize * 2), Math.ceil(fontSize * ch * 0.55))
  const h = Math.ceil(fontSize * 1.35)
  return { w, h }
}

export function clampTextLayerDxDy(
  areaWidth: number,
  areaHeight: number,
  layer: Pick<PlacementTextLayer, 'dx' | 'dy' | 'fontSize' | 'text' | 'rotation'>
): { dx: number; dy: number } {
  const { w, h } = estimateTextLayerBox(layer.text, layer.fontSize)
  const cx = areaWidth / 2 + layer.dx
  const cy = areaHeight / 2 + layer.dy
  const c = clampCenteredRectInPrintArea(areaWidth, areaHeight, cx, cy, w, h, layer.rotation ?? 0)
  return { dx: c.cx - areaWidth / 2, dy: c.cy - areaHeight / 2 }
}

/** Single-image direct URL to Printful is only valid without text, a single bitmap, and no rotation. */
export function placementLayersNeedServerComposite(layers: PlacementLayer[]): boolean {
  if (layers.length === 0) return false
  const hasText = layers.some(isTextLayer)
  const imageLayers = layers.filter(isImageLayer)
  if (hasText || imageLayers.length > 1) return true
  if (imageLayers.length === 1 && (imageLayers[0].rotation ?? 0) !== 0) return true
  return false
}

/** Override for `printful_placements` / mockup `position` when using one raster per placement. */
export function imageLayerToPlacementOverride(
  layer: PlacementImageLayer,
  areaWidth: number,
  areaHeight: number
): PlacementCompactTransform {
  const { w, h } = getImageLayerDimensions(layer, areaWidth, areaHeight)
  return {
    s: layer.s,
    dx: layer.dx,
    dy: layer.dy,
    width: w,
    height: h,
  }
}

/**
 * After printfile dimensions are known: set explicit width/height on direct (non-composite) image placements.
 */
export function enrichDirectImagePlacementOverrides(
  overrides: Record<string, PlacementCompactTransform>,
  perPlacementPaths: Record<string, PlacementLayer[]>,
  getAreaForPlacement: (placement: string) => { width: number; height: number }
): Record<string, PlacementCompactTransform> {
  const out: Record<string, PlacementCompactTransform> = {}
  for (const [placement, t] of Object.entries(overrides)) {
    const layers = perPlacementPaths[placement]
    const imgs = layers?.filter(isImageLayer) ?? []
    if (layers && imgs.length === 1 && !placementLayersNeedServerComposite(layers)) {
      const { width, height } = getAreaForPlacement(placement)
      out[placement] = imageLayerToPlacementOverride(imgs[0], width, height)
    } else {
      out[placement] = t
    }
  }
  return out
}

/** Per-placement layers keyed by Printful placement name. */
export type PlacementImagesState = Record<string, PlacementLayer[]>

const PATTERN_IMAGES_KEY = 'pattern_images'

function parseLayer(v: unknown): PlacementLayer | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  // Text layer
  if (o.type === 'text') {
    if (typeof o.text !== 'string') return null
    const rot = typeof o.rotation === 'number' && Number.isFinite(o.rotation) ? o.rotation : undefined
    return {
      id: typeof o.id === 'string' && o.id.trim() ? o.id : crypto.randomUUID(),
      type: 'text',
      text: o.text,
      fontFamily: typeof o.fontFamily === 'string' && o.fontFamily.trim() ? o.fontFamily : 'Roboto',
      fontSize: typeof o.fontSize === 'number' && o.fontSize > 0 ? o.fontSize : 120,
      color: typeof o.color === 'string' && o.color.trim() ? o.color : '#000000',
      dx: typeof o.dx === 'number' ? o.dx : 0,
      dy: typeof o.dy === 'number' ? o.dy : 0,
      ...(rot !== undefined ? { rotation: rot } : {}),
    }
  }
  // Image layer (no type field, or type !== 'text')
  if (typeof o.path !== 'string' || !o.path.trim()) return null
  const w = typeof o.w === 'number' && o.w > 0 ? o.w : undefined
  const h = typeof o.h === 'number' && o.h > 0 ? o.h : undefined
  const rot = typeof o.rotation === 'number' && Number.isFinite(o.rotation) ? o.rotation : undefined
  return {
    id: typeof o.id === 'string' && o.id.trim() ? o.id : crypto.randomUUID(),
    path: o.path,
    s: typeof o.s === 'number' && o.s > 0 && o.s <= 1 ? o.s : 1,
    dx: typeof o.dx === 'number' ? o.dx : 0,
    dy: typeof o.dy === 'number' ? o.dy : 0,
    ...(w !== undefined && h !== undefined ? { w, h } : {}),
    ...(rot !== undefined ? { rotation: rot } : {}),
  }
}

/**
 * Parse design_state.pattern_images.
 * Handles both legacy string values and new array-of-layers format (image + text).
 */
export function parsePlacementImages(raw: unknown): PlacementImagesState {
  if (!raw || typeof raw !== 'object') return {}
  const block = (raw as Record<string, unknown>)[PATTERN_IMAGES_KEY]
  if (!block || typeof block !== 'object') return {}
  const out: PlacementImagesState = {}
  for (const [placement, v] of Object.entries(block)) {
    if (Array.isArray(v)) {
      const layers = v.map(parseLayer).filter((l): l is PlacementLayer => l !== null)
      if (layers.length) out[placement] = layers
    } else if (typeof v === 'string' && v.trim()) {
      // Legacy single-string format → wrap as single image layer
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

/** Return a new state with a new image layer appended to the given placement. */
export function addPlacementImageLayer(
  current: PlacementImagesState,
  placement: string,
  layer: PlacementImageLayer
): PlacementImagesState {
  return { ...current, [placement]: [...(current[placement] ?? []), layer] }
}

/** Return a new state with a new text layer appended to the given placement. */
export function addPlacementTextLayer(
  current: PlacementImagesState,
  placement: string,
  layer: PlacementTextLayer
): PlacementImagesState {
  return { ...current, [placement]: [...(current[placement] ?? []), layer] }
}

/** Return a new state with a specific layer's fields updated (works for both image and text layers). */
export function updatePlacementLayer(
  current: PlacementImagesState,
  placement: string,
  layerId: string,
  patch: PlacementLayerPatch
): PlacementImagesState {
  const layers = (current[placement] ?? []).map((l) =>
    l.id === layerId ? { ...l, ...patch } : l
  )
  return { ...current, [placement]: layers }
}

/** @deprecated Use updatePlacementLayer */
export function updatePlacementImageLayer(
  current: PlacementImagesState,
  placement: string,
  layerId: string,
  patch: Partial<Pick<PlacementImageLayer, 's' | 'dx' | 'dy'>>
): PlacementImagesState {
  return updatePlacementLayer(current, placement, layerId, patch)
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
