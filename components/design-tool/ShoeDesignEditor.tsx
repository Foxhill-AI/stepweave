'use client'

import { useMemo } from 'react'
import type { PlacementTemplateRow } from '@/lib/printful/placementTemplate'
import type { PlacementCompactTransform } from '@/lib/designDraftState'
import PlacementCanvasPreview from './PlacementCanvasPreview'

export type ShoeDesignEditorProps = {
  /** Rows from GET .../templates (only those with template_url are required for silhouette mode). */
  templates: PlacementTemplateRow[]
  activePlacement: string
  onActivePlacementChange: (placement: string) => void
  /** Transform for the active placement */
  transform: PlacementCompactTransform
  patternImageUrl?: string | null
  onPlacementChange: (patch: Partial<PlacementCompactTransform>) => void
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
  transform,
  patternImageUrl = null,
  onPlacementChange,
  disabled = false,
}: ShoeDesignEditorProps) {
  const rows = useMemo(
    () => templates.filter((t) => t.template_url?.trim()),
    [templates]
  )

  const current = rows.find((r) => r.placement === activePlacement) ?? rows[0]

  if (!current) {
    return null
  }

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
              <span className="shoe-design-tab-dims">
                {row.area_width}×{row.area_height}
              </span>
            </button>
          )
        })}
      </div>

      <p className="shoe-design-hint">
        Silueta de Printful (plantilla) + área de impresión. Arrastra el patrón y usa la rueda para
        escalar; los valores se guardan igual que en el editor estándar.
      </p>

      <div className="shoe-design-composite">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.template_url}
          alt=""
          className="shoe-design-template-img"
          draggable={false}
        />
        <div className="shoe-design-overlay">
          <div className="shoe-design-overlay-inner">
            <PlacementCanvasPreview
              areaWidth={current.area_width}
              areaHeight={current.area_height}
              s={transform.s}
              dx={transform.dx}
              dy={transform.dy}
              patternUrl={patternImageUrl}
              onChange={onPlacementChange}
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
