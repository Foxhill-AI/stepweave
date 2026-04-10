'use client'

import { useMemo, useRef, useEffect } from 'react'
import type { PlacementTemplateRow } from '@/lib/printful/placementTemplate'
import type { ResolvedPlacementLayer, PlacementLayerPatch } from '@/lib/designDraftState'
import PlacementCanvasPreview from './PlacementCanvasPreview'

/** Pre-layout/decode `offsetWidth` can be ~2px; never lock `.shoe-design-composite` to that (img is width:100%). */
const MIN_TEMPLATE_LAYOUT_PX = 32

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
  onLayerDelete?: (layerId: string) => void
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
  onLayerDelete,
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

    // Placeholder until intrinsic layout is trustworthy (percentage overlay needs a height box)
    composite.style.removeProperty('width')
    composite.style.height = '200px'

    const sync = () => {
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      const w = img.offsetWidth
      const h = img.offsetHeight
      const layoutReady =
        nw > 0 &&
        nh > 0 &&
        w >= MIN_TEMPLATE_LAYOUT_PX &&
        h >= MIN_TEMPLATE_LAYOUT_PX

      if (layoutReady) {
        composite.style.width = `${w}px`
        composite.style.height = `${h}px`
      } else {
        // Break 2×2px trap: drop inline width so CSS `width:100%` / max-width can size the img again
        composite.style.removeProperty('width')
        composite.style.height = '200px'
      }
    }

    sync()
    img.addEventListener('load', sync)
    const ro = new ResizeObserver(sync)
    ro.observe(img)
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
      composite.style.removeProperty('width')
      composite.style.removeProperty('height')
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
              onLayerDelete={onLayerDelete}
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
