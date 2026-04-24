'use client'

import { useState, useEffect, useCallback, useMemo, type MutableRefObject } from 'react'
import type { PlacementMeta } from '@/app/api/printful/products/[id]/placements/route'
import type {
  PrintfulPlacementsState,
  ResolvedPlacementLayer,
  PlacementLayerPatch,
  PlacementLayer,
  PlacementLayerReorderOp,
} from '@/lib/designDraftState'
import { mergeAndClampPlacement, updatePlacementTransform, isTextLayer } from '@/lib/designDraftState'
import type { PlacementTemplateRow } from '@/lib/printful/placementTemplate'
import PlacementCanvasPreview from './PlacementCanvasPreview'
import ShoeDesignEditor from './ShoeDesignEditor'

interface PlacementEditorPanelProps {
  productId: string
  variantId: number | null
  /** Current transforms from design_state */
  placementsState: PrintfulPlacementsState
  /** Update React state (design_state); functional form avoids stale state while dragging */
  onPlacementsStateChange: (
    nextOrUpdater:
      | PrintfulPlacementsState
      | ((prev: PrintfulPlacementsState) => PrintfulPlacementsState)
  ) => void
  /** Persist design_state to Supabase */
  onSaveLayout: () => Promise<void>
  /** Run Printful mockup job with pattern + transforms */
  onRefreshPrintfulPreview: () => Promise<void>
  hasPatternImage: boolean
  /** Signed/public URL for live canvas (optional; placeholder if missing) */
  patternImageUrl?: string | null
  saveLoading?: boolean
  previewLoading?: boolean
  /** When provided, use these template rows instead of fetching internally. */
  externalTemplateRows?: PlacementTemplateRow[]
  /** When provided, use this loading state instead of internal. */
  externalTemplatesLoading?: boolean
  /** When provided, use this as controlled active placement. */
  externalActivePlacement?: string
  onExternalActivePlacementChange?: (placement: string) => void
  /** When true, the canvas (ShoeDesignEditor / PlacementCanvasPreview) is rendered elsewhere — skip it here. */
  hideCanvas?: boolean
  /** When true, action buttons (save layout, update preview) are rendered elsewhere — skip them here. */
  hideActions?: boolean
  // --- Multi-layer support ---
  /** Resolved layers for the active placement (image + text). When provided, controls operate on the selected layer. */
  activeLayers?: ResolvedPlacementLayer[]
  selectedLayerId?: string | null
  onLayerSelect?: (id: string) => void
  onLayerChange?: (layerId: string, patch: PlacementLayerPatch) => void
  onLayerDelete?: (layerId: string) => void
  onLayerReorder?: (layerId: string, op: PlacementLayerReorderOp) => void
  onLayerDuplicate?: (layerId: string) => void
  onPasteLayer?: (layer: PlacementLayer) => void
  layerClipboardRef?: MutableRefObject<PlacementLayer | null>
}

export default function PlacementEditorPanel({
  productId,
  variantId,
  placementsState,
  onPlacementsStateChange,
  onSaveLayout,
  onRefreshPrintfulPreview,
  hasPatternImage,
  patternImageUrl = null,
  saveLoading = false,
  previewLoading = false,
  externalTemplateRows,
  externalTemplatesLoading,
  externalActivePlacement,
  onExternalActivePlacementChange,
  hideCanvas = false,
  hideActions = false,
  activeLayers,
  selectedLayerId,
  onLayerSelect,
  onLayerChange,
  onLayerDelete,
  onLayerReorder,
  onLayerDuplicate,
  onPasteLayer,
  layerClipboardRef,
}: PlacementEditorPanelProps) {
  const [meta, setMeta] = useState<PlacementMeta[]>([])
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  // Internal template state — only used when externalTemplateRows is not provided
  const [templateRows, setTemplateRows] = useState<PlacementTemplateRow[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  // Internal active placement — only used when externalActivePlacement is not provided
  const [internalActivePlacement, setInternalActivePlacement] = useState<string>('')
  const [localMsg, setLocalMsg] = useState<string | null>(null)

  // Effective values: prefer external when provided
  const effectiveTemplateRows = externalTemplateRows ?? templateRows
  const effectiveTemplatesLoading = externalTemplatesLoading ?? templatesLoading

  // Controlled placement: use external when provided, otherwise internal
  const isControlledPlacement = externalActivePlacement !== undefined
  const activePlacement = isControlledPlacement ? externalActivePlacement : internalActivePlacement

  // Write helper: routes to external callback or internal state setter
  const setActivePlacement = useCallback(
    (placement: string) => {
      if (isControlledPlacement && onExternalActivePlacementChange) {
        onExternalActivePlacementChange(placement)
      } else {
        setInternalActivePlacement(placement)
      }
    },
    [isControlledPlacement, onExternalActivePlacementChange]
  )

  useEffect(() => {
    if (!productId || !variantId) {
      setMeta([])
      if (!isControlledPlacement) setInternalActivePlacement('')
      return
    }
    let cancelled = false
    setMetaLoading(true)
    setMetaError(null)
    fetch(
      `/api/printful/products/${encodeURIComponent(productId)}/placements?variant_id=${variantId}`
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('placements'))))
      .then((body: { placements?: PlacementMeta[] }) => {
        if (cancelled) return
        const list = body.placements ?? []
        setMeta(list)
        if (list.length && !list.some((p) => p.placement === activePlacement)) {
          setActivePlacement(list[0].placement)
        }
      })
      .catch(() => {
        if (!cancelled) setMetaError('Could not load print placements.')
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId, variantId])

  // Only fetch templates internally when externalTemplateRows is not provided
  useEffect(() => {
    if (externalTemplateRows !== undefined) return
    if (!productId || !variantId) {
      setTemplateRows([])
      return
    }
    let cancelled = false
    setTemplatesLoading(true)
    fetch(
      `/api/printful/products/${encodeURIComponent(productId)}/templates?variant_id=${variantId}`
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('templates'))))
      .then((body: { placements?: PlacementTemplateRow[] }) => {
        if (cancelled) return
        setTemplateRows(body.placements ?? [])
      })
      .catch(() => {
        if (!cancelled) setTemplateRows([])
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId, variantId, externalTemplateRows])

  const templateWithUrl = effectiveTemplateRows.filter((r) => r.template_url?.trim())
  const useShoeTemplateUi = !effectiveTemplatesLoading && templateWithUrl.length > 0

  const displayPlacement = useMemo(() => {
    if (useShoeTemplateUi && templateWithUrl.length > 0) {
      return templateWithUrl.some((r) => r.placement === activePlacement)
        ? activePlacement
        : templateWithUrl[0].placement
    }
    return activePlacement
  }, [useShoeTemplateUi, templateWithUrl, activePlacement])

  useEffect(() => {
    if (useShoeTemplateUi && displayPlacement !== activePlacement) {
      setActivePlacement(displayPlacement)
    }
  }, [useShoeTemplateUi, displayPlacement, activePlacement])

  const editingPlacement = displayPlacement
  const current = meta.find((m) => m.placement === activePlacement)
  const currentTemplate = templateWithUrl.find((r) => r.placement === editingPlacement)

  // When layer-based mode is active, read transform from the selected (or only) layer
  const usingLayers = activeLayers !== undefined && activeLayers.length > 0
  const effectiveSelectedId = usingLayers && activeLayers!.length === 1
    ? activeLayers![0].id
    : selectedLayerId ?? null
  const selectedLayer = usingLayers
    ? (activeLayers!.find((l) => l.id === effectiveSelectedId) ?? activeLayers![0])
    : null
  const selectedIsText = selectedLayer != null && isTextLayer(selectedLayer)
  // Unified transform view: s is 1 for text layers (they use fontSize instead)
  const t = selectedLayer
    ? { s: selectedIsText ? 1 : (selectedLayer as { s: number }).s, dx: selectedLayer.dx, dy: selectedLayer.dy }
    : (placementsState[editingPlacement] ?? { s: 1, dx: 0, dy: 0 })

  /** Update transforms for the active layer or placement. */
  const patchActive = useCallback(
    (patch: Partial<{ s: number; dx: number; dy: number }>) => {
      if (!editingPlacement) return

      // Layer-based mode: update the selected layer's transform
      if (onLayerChange && selectedLayer) {
        if (selectedIsText) {
          // Text layers: only dx/dy, no scale
          const p: Partial<{ dx: number; dy: number }> = {}
          if ('dx' in patch) p.dx = patch.dx
          if ('dy' in patch) p.dy = patch.dy
          if (Object.keys(p).length > 0) onLayerChange(selectedLayer.id, p)
        } else {
          const dims = currentTemplate ?? meta.find((m) => m.placement === editingPlacement)
          const merged = dims
            ? mergeAndClampPlacement(dims.area_width, dims.area_height, t, patch)
            : { ...t, ...patch }
          onLayerChange(selectedLayer.id, merged)
        }
        return
      }

      // Legacy mode: update printful_placements
      const dims = currentTemplate ?? meta.find((m) => m.placement === editingPlacement)
      onPlacementsStateChange((prev) => {
        if (!dims) return updatePlacementTransform(prev, editingPlacement, patch)
        const prevT = prev[editingPlacement] ?? { s: 1, dx: 0, dy: 0 }
        const merged = mergeAndClampPlacement(dims.area_width, dims.area_height, prevT, patch)
        return updatePlacementTransform(prev, editingPlacement, merged)
      })
    },
    [editingPlacement, onPlacementsStateChange, onLayerChange, selectedLayer, selectedIsText, t, currentTemplate, meta]
  )

  const handleSave = async () => {
    setLocalMsg(null)
    try {
      await onSaveLayout()
      setLocalMsg('Layout saved to draft.')
    } catch {
      setLocalMsg('Save failed.')
    }
  }

  const handlePreview = async () => {
    setLocalMsg(null)
    try {
      await onRefreshPrintfulPreview()
      setLocalMsg('Preview updated from Printful.')
    } catch {
      setLocalMsg('Preview request failed.')
    }
  }

  if (!productId || !variantId) return null

  return (
    <div className="placement-editor-panel" aria-label="Print placement editor">
      <h3 className="placement-editor-title">Print placement</h3>

      {metaLoading && <p className="placement-editor-status">Loading placements…</p>}
      {metaError && (
        <p className="placement-editor-error" role="alert">
          {metaError}
        </p>
      )}
      {/* Only show template loading message when not managed externally */}
      {effectiveTemplatesLoading && externalTemplatesLoading === undefined && (
        <p className="placement-editor-status" role="status">
          Loading Printful silhouette templates…
        </p>
      )}

      {!metaLoading && meta.length > 0 && (
        <>
          {!useShoeTemplateUi && (
            <>
              <label className="design-tool-label" htmlFor="placement-editor-select">
                Placement
              </label>
              <select
                id="placement-editor-select"
                className="design-tool-select"
                value={activePlacement}
                onChange={(e) => setActivePlacement(e.target.value)}
              >
                {meta.map((m) => (
                  <option key={m.placement} value={m.placement}>
                    {m.label} ({m.area_width}×{m.area_height}px)
                  </option>
                ))}
              </select>
            </>
          )}

          {/* Canvas rendering is skipped when hideCanvas=true (rendered elsewhere) */}
          {!hideCanvas && useShoeTemplateUi && currentTemplate && (
            <ShoeDesignEditor
              templates={effectiveTemplateRows}
              activePlacement={editingPlacement}
              onActivePlacementChange={setActivePlacement}
              layers={activeLayers ?? []}
              selectedLayerId={effectiveSelectedId}
              onLayerSelect={onLayerSelect}
              onLayerChange={onLayerChange ?? (() => {})}
              onLayerDelete={onLayerDelete}
              onLayerReorder={onLayerReorder}
              onLayerDuplicate={onLayerDuplicate}
              onPasteLayer={onPasteLayer}
              layerClipboardRef={layerClipboardRef}
            />
          )}

          {!hideCanvas && !useShoeTemplateUi && current && (
            <PlacementCanvasPreview
              areaWidth={current.area_width}
              areaHeight={current.area_height}
              layers={activeLayers ?? []}
              selectedLayerId={effectiveSelectedId}
              onLayerSelect={onLayerSelect}
              onLayerChange={onLayerChange ?? (() => {})}
              onLayerDelete={onLayerDelete}
              onLayerReorder={onLayerReorder}
              onLayerDuplicate={onLayerDuplicate}
              onPasteLayer={onPasteLayer}
              layerClipboardRef={layerClipboardRef}
            />
          )}

          {(current || currentTemplate) && (
            <div className="placement-editor-controls">
                {selectedIsText && selectedLayer ? (
                  <div className="placement-editor-field">
                    <label htmlFor="pe-fontsize">Font size (px)</label>
                    <input
                      id="pe-fontsize"
                      type="range"
                      min={20}
                      max={500}
                      value={(selectedLayer as { fontSize: number }).fontSize}
                      onChange={(e) =>
                        onLayerChange?.(selectedLayer.id, { fontSize: Number(e.target.value) })
                      }
                    />
                    <span className="placement-editor-value">
                      {(selectedLayer as { fontSize: number }).fontSize}px
                    </span>
                  </div>
                ) : (
                  <div className="placement-editor-field">
                    <label htmlFor="pe-scale">Scale in print area</label>
                    <input
                      id="pe-scale"
                      type="range"
                      min={5}
                      max={100}
                      value={Math.round(t.s * 100)}
                      onChange={(e) =>
                        patchActive({ s: Math.max(0.05, Number(e.target.value) / 100) })
                      }
                    />
                    <span className="placement-editor-value">{Math.round(t.s * 100)}%</span>
                  </div>
                )}
                {selectedLayer && !selectedIsText && onLayerChange && (
                  <div className="placement-editor-field placement-editor-field--tile">
                    <label className="placement-editor-checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean((selectedLayer as { repeat?: boolean }).repeat)}
                        onChange={(e) =>
                          onLayerChange(selectedLayer.id, { repeat: e.target.checked })
                        }
                      />
                      <span>Tile / repeat to fill area</span>
                    </label>
                    <p className="placement-editor-hint">
                      Repeats the image at the current size in all directions (resize first for smaller tiles).
                      Updates preview via server composite.
                    </p>
                  </div>
                )}
                <div className="placement-editor-field-row">
                  <div className="placement-editor-field">
                    <label htmlFor="pe-dx">Offset X (px)</label>
                    <input
                      id="pe-dx"
                      type="number"
                      className="design-tool-input"
                      value={Math.round(t.dx)}
                      onChange={(e) => patchActive({ dx: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="placement-editor-field">
                    <label htmlFor="pe-dy">Offset Y (px)</label>
                    <input
                      id="pe-dy"
                      type="number"
                      className="design-tool-input"
                      value={Math.round(t.dy)}
                      onChange={(e) => patchActive({ dy: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
          )}

          {!hideActions && (
            <>
              <div className="placement-editor-actions">
                <button
                  type="button"
                  className="design-tool-btn design-tool-btn-secondary"
                  onClick={() => void handleSave()}
                  disabled={saveLoading}
                >
                  {saveLoading ? 'Saving…' : 'Save layout to draft'}
                </button>
                <button
                  type="button"
                  className="design-tool-btn design-tool-btn-publish"
                  onClick={() => void handlePreview()}
                  disabled={previewLoading || !hasPatternImage}
                  title={
                    hasPatternImage
                      ? 'Generate Printful mockups with your pattern'
                      : 'Add a pattern first'
                  }
                >
                  {previewLoading ? 'Generating…' : 'Update preview'}
                </button>
              </div>
              {localMsg && (
                <p className="placement-editor-msg" role="status">
                  {localMsg}
                </p>
              )}
              {!hasPatternImage && (
                <p className="placement-editor-warn" role="note">
                  Upload or generate a pattern to enable Printful mockups.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
