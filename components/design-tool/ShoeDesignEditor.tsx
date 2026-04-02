'use client'

import { useMemo, useRef, useEffect } from 'react'
import type { PlacementTemplateRow } from '@/lib/printful/placementTemplate'
import type { ResolvedPlacementLayer, PlacementLayerPatch } from '@/lib/designDraftState'
import PlacementCanvasPreview from './PlacementCanvasPreview'

export type ShoeDesignEditorProps = {
  /** Rows from GET .../templates (only those with template_url are required for silhouette mode). */
  templates: PlacementTemplateRow[]
  activePlacement: string
  onActivePlacementChange: (placement: string) => void
  /** Layers for the active placement (image + text). */
  layers: ResolvedPlacementLayer[]
  selectedLayerId?: string | null
  onLayerSelect?: (id: string) => void
  onLayerChange: (layerId: string, patch: PlacementLayerPatch) => void
  disabled?: boolean
}

/**
 * Printful-style shoe editor: silhouette/template base layer + draggable print area overlay.
 * Tabs switch placements (left/right/label, etc.).
 */
export default function ShoeDesignEditor({
  templates,
  activePlacement,
  onActivePlacementChange,
  layers,
  selectedLayerId,
  onLayerSelect,
  onLayerChange,
  disabled = false,
}: ShoeDesignEditorProps) {
  const rows = useMemo(
    () => templates.filter((t) => t.template_url?.trim()),
    [templates]
  )

  const current = rows.find((r) => r.placement === activePlacement) ?? rows[0]

  const compositeRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Keep composite width = image's actual rendered width so overlay percentages stay accurate
  useEffect(() => {
    const img = imgRef.current
    const composite = compositeRef.current
    if (!img || !composite) return

    // Set explicit placeholder height immediately so percentage-based overlay
    // heights resolve correctly on desktop before the image finishes loading
    composite.style.height = '200px'

    const sync = () => {
      const w = img.offsetWidth
      if (w > 0) composite.style.width = `${w}px`
      const h = img.offsetHeight
      if (h > 0) composite.style.height = `${h}px`
      // #region agent log
      fetch('http://127.0.0.1:7893/ingest/8125b979-4f7a-423b-8878-365342928e92', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffdcdb' },
        body: JSON.stringify({
          sessionId: 'ffdcdb',
          runId: 'post-fix',
          hypothesisId: 'F',
          location: 'ShoeDesignEditor.tsx:sync',
          message: 'template composite sync',
          data: {
            ow: img.offsetWidth,
            oh: img.offsetHeight,
            complete: img.complete,
            nw: img.naturalWidth,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
    }

    sync()
    img.addEventListener('load', sync)
    const ro = new ResizeObserver(sync)
    ro.observe(img)
    // Cached / decoded template: `load` does not fire again; without this the composite
    // can keep width/height at 0 or the 200px placeholder → blank canvas until full reload.
    let raf = 0
    if (img.complete) {
      raf = requestAnimationFrame(() => {
        sync()
        requestAnimationFrame(sync)
      })
    }
    return () => {
      if (raf) cancelAnimationFrame(raf)
      img.removeEventListener('load', sync)
      ro.disconnect()
      composite.style.height = ''
    }
  }, [current?.template_url, layers.length])

  if (!current) return null

  const hasExactBounds =
    current.template_width != null &&
    current.template_height != null &&
    current.print_area_left != null &&
    current.print_area_top != null &&
    current.print_area_width != null &&
    current.print_area_height != null

  const overlayStyle = hasExactBounds
    ? {
        inset: 'auto' as const,
        display: 'block' as const,
        left: `${(current.print_area_left! / current.template_width!) * 100}%`,
        top: `${(current.print_area_top! / current.template_height!) * 100}%`,
        width: `${(current.print_area_width! / current.template_width!) * 100}%`,
        height: `${(current.print_area_height! / current.template_height!) * 100}%`,
      }
    : undefined

  return (
    <div className="shoe-design-editor" aria-label="Shoe template design editor">
      <div className="shoe-design-tabs" role="tablist" aria-label="Print placements">
        {rows.map((row) => {
          const selected = row.placement === activePlacement
          return (
            <button
              key={row.placement}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`shoe-design-tab ${selected ? 'shoe-design-tab--active' : ''}`}
              onClick={() => onActivePlacementChange(row.placement)}
            >
              {row.label}
            </button>
          )
        })}
      </div>

      <div ref={compositeRef} className="shoe-design-composite">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={current.template_url}
          alt=""
          className="shoe-design-template-img"
          draggable={false}
        />
        <div className="shoe-design-overlay" style={overlayStyle}>
          <div className={`shoe-design-overlay-inner${hasExactBounds ? ' shoe-design-overlay-inner--exact' : ''}`}>
            <PlacementCanvasPreview
              areaWidth={current.area_width}
              areaHeight={current.area_height}
              layers={layers}
              selectedLayerId={selectedLayerId}
              onLayerSelect={onLayerSelect}
              onLayerChange={onLayerChange}
              disabled={disabled}
              variant="overlay"
              hideHint
            />
          </div>
        </div>
      </div>
    </div>
  )
}
