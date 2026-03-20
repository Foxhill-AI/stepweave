'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PlacementMeta } from '@/app/api/printful/products/[id]/placements/route'
import type { PrintfulPlacementsState } from '@/lib/designDraftState'
import { updatePlacementTransform } from '@/lib/designDraftState'

interface PlacementEditorPanelProps {
  productId: string
  variantId: number | null
  /** Current transforms from design_state */
  placementsState: PrintfulPlacementsState
  /** Update React state (design_state) */
  onPlacementsStateChange: (next: PrintfulPlacementsState) => void
  /** Persist design_state to Supabase */
  onSaveLayout: () => Promise<void>
  /** Run Printful mockup job with pattern + transforms */
  onRefreshPrintfulPreview: () => Promise<void>
  hasPatternImage: boolean
  saveLoading?: boolean
  previewLoading?: boolean
}

export default function PlacementEditorPanel({
  productId,
  variantId,
  placementsState,
  onPlacementsStateChange,
  onSaveLayout,
  onRefreshPrintfulPreview,
  hasPatternImage,
  saveLoading = false,
  previewLoading = false,
}: PlacementEditorPanelProps) {
  const [meta, setMeta] = useState<PlacementMeta[]>([])
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [activePlacement, setActivePlacement] = useState<string>('')
  const [localMsg, setLocalMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!productId || !variantId) {
      setMeta([])
      setActivePlacement('')
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

  const current = meta.find((m) => m.placement === activePlacement)
  const t = placementsState[activePlacement] ?? { s: 1, dx: 0, dy: 0 }

  const patchActive = useCallback(
    (patch: Partial<{ s: number; dx: number; dy: number }>) => {
      if (!activePlacement) return
      onPlacementsStateChange(
        updatePlacementTransform(placementsState, activePlacement, patch)
      )
    },
    [activePlacement, placementsState, onPlacementsStateChange]
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
      <h3 className="placement-editor-title">Print placement (design_state)</h3>
      <p className="placement-editor-hint">
        Adjust how your pattern fits each print area. Values are stored in{' '}
        <code>design_state.printful_placements</code>. Use &quot;Product preview&quot; to render
        mockups with your uploaded/generated pattern.
      </p>

      {metaLoading && <p className="placement-editor-status">Loading placements…</p>}
      {metaError && (
        <p className="placement-editor-error" role="alert">
          {metaError}
        </p>
      )}

      {!metaLoading && meta.length > 0 && (
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

          {current && (
            <div className="placement-editor-controls">
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
              <div className="placement-editor-field">
                <label htmlFor="pe-dx">Offset X (px)</label>
                <input
                  id="pe-dx"
                  type="number"
                  className="design-tool-input"
                  value={t.dx}
                  onChange={(e) => patchActive({ dx: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="placement-editor-field">
                <label htmlFor="pe-dy">Offset Y (px)</label>
                <input
                  id="pe-dy"
                  type="number"
                  className="design-tool-input"
                  value={t.dy}
                  onChange={(e) => patchActive({ dy: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          )}

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
                  ? 'Calls Printful with your pattern (may take ~15–90s)'
                  : 'Add a pattern first'
              }
            >
              {previewLoading ? 'Generating preview…' : 'Update product preview (Printful)'}
            </button>
          </div>
          {localMsg && (
            <p className="placement-editor-msg" role="status">
              {localMsg}
            </p>
          )}
          {!hasPatternImage && (
            <p className="placement-editor-warn" role="note">
              Upload or generate a pattern to enable Printful mockups with your artwork.
            </p>
          )}
        </>
      )}
    </div>
  )
}
