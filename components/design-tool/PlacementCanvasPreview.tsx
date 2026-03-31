'use client'

import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import { mergeAndClampPlacement } from '@/lib/designDraftState'
import type { ResolvedPlacementImageLayer } from '@/lib/designDraftState'

export type PlacementCanvasPreviewProps = {
  areaWidth: number
  areaHeight: number
  /** Image layers to render. Each layer has its own position transform. */
  layers: ResolvedPlacementImageLayer[]
  /** ID of the currently selected layer. Auto-selects the only layer when there is exactly one. */
  selectedLayerId?: string | null
  onLayerSelect?: (id: string) => void
  onLayerChange: (layerId: string, patch: Partial<{ s: number; dx: number; dy: number }>) => void
  disabled?: boolean
  /**
   * `overlay`: transparent stage, dashed border — for shoe template composite.
   * `default`: standalone print-area preview.
   */
  variant?: 'default' | 'overlay'
  /** Hide instruction paragraph (e.g. when parent provides context). */
  hideHint?: boolean
}

/**
 * Visual print-area canvas: drag/scroll each image layer independently.
 * Supports multiple layers per placement — click a layer to select it,
 * then drag or scroll to reposition/scale it.
 */
export default function PlacementCanvasPreview({
  areaWidth,
  areaHeight,
  layers,
  selectedLayerId: externalSelectedId,
  onLayerSelect,
  onLayerChange,
  disabled = false,
  variant = 'default',
  hideHint = false,
}: PlacementCanvasPreviewProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [displayScale, setDisplayScale] = useState(1)

  // When there is exactly one layer, always treat it as selected for seamless UX
  const effectiveSelectedId =
    layers.length === 1 ? layers[0].id : (externalSelectedId ?? null)

  // Refs to avoid stale closures in event handlers
  const layersRef = useRef(layers)
  layersRef.current = layers
  const effectiveSelectedIdRef = useRef(effectiveSelectedId)
  effectiveSelectedIdRef.current = effectiveSelectedId
  const onLayerChangeRef = useRef(onLayerChange)
  onLayerChangeRef.current = onLayerChange

  const dragRef = useRef<{
    layerId: string
    sx: number
    sy: number
    dx0: number
    dy0: number
  } | null>(null)

  // Track displayScale via ResizeObserver
  useEffect(() => {
    const el = stageRef.current
    if (!el || areaWidth <= 0) return
    const update = () => {
      const w = el.clientWidth
      if (w > 0) setDisplayScale(w / areaWidth)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [areaWidth])

  // Wheel → scale selected layer
  useEffect(() => {
    const el = stageRef.current
    if (!el || disabled) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const layerId = effectiveSelectedIdRef.current
      if (!layerId) return
      const layer = layersRef.current.find((l) => l.id === layerId)
      if (!layer) return
      const factor = e.deltaY > 0 ? 0.94 : 1.06
      const nextS = Math.min(1, Math.max(0.05, layer.s * factor))
      if (Math.abs(nextS - layer.s) < 1e-6) return
      const merged = mergeAndClampPlacement(
        areaWidth,
        areaHeight,
        { s: nextS, dx: layer.dx, dy: layer.dy },
        { s: nextS }
      )
      const out: Partial<{ s: number; dx: number; dy: number }> = {}
      if (merged.s !== layer.s) out.s = merged.s
      if (merged.dx !== layer.dx) out.dx = merged.dx
      if (merged.dy !== layer.dy) out.dy = merged.dy
      if (Object.keys(out).length > 0) onLayerChangeRef.current(layerId, out)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [disabled, areaWidth, areaHeight])

  // Render selected layer on top
  const orderedLayers = useMemo(() => {
    if (!effectiveSelectedId) return layers
    return [
      ...layers.filter((l) => l.id !== effectiveSelectedId),
      ...layers.filter((l) => l.id === effectiveSelectedId),
    ]
  }, [layers, effectiveSelectedId])

  const stageClass =
    variant === 'overlay'
      ? 'placement-canvas-stage placement-canvas-stage--overlay'
      : 'placement-canvas-stage'
  const hintId = 'placement-canvas-desc'

  const handleLayerPointerDown = useCallback(
    (e: React.PointerEvent, layer: ResolvedPlacementImageLayer) => {
      if (disabled) return
      e.preventDefault()
      e.stopPropagation()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      onLayerSelect?.(layer.id)
      dragRef.current = { layerId: layer.id, sx: e.clientX, sy: e.clientY, dx0: layer.dx, dy0: layer.dy }
    },
    [disabled, onLayerSelect]
  )

  const handleLayerPointerMove = useCallback(
    (e: React.PointerEvent, layer: ResolvedPlacementImageLayer, ds: number) => {
      if (!dragRef.current || dragRef.current.layerId !== layer.id || disabled) return
      const d = dragRef.current
      const dPrintX = (e.clientX - d.sx) / ds
      const dPrintY = (e.clientY - d.sy) / ds
      const merged = mergeAndClampPlacement(
        areaWidth,
        areaHeight,
        { s: layer.s, dx: d.dx0 + dPrintX, dy: d.dy0 + dPrintY },
        { dx: d.dx0 + dPrintX, dy: d.dy0 + dPrintY }
      )
      const out: Partial<{ s: number; dx: number; dy: number }> = {}
      if (merged.dx !== layer.dx) out.dx = merged.dx
      if (merged.dy !== layer.dy) out.dy = merged.dy
      if (Object.keys(out).length > 0) onLayerChangeRef.current(layer.id, out)
    },
    [disabled, areaWidth, areaHeight]
  )

  const endDrag = useCallback((e: React.PointerEvent, layerId: string) => {
    if (dragRef.current?.layerId === layerId) {
      dragRef.current = null
      try { ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    }
  }, [])

  return (
    <div className={variant === 'overlay' ? 'placement-canvas-root placement-canvas-root--embedded' : 'placement-canvas-root'}>
      {!hideHint && (
        <p className="placement-canvas-hint" id={hintId}>
          Click an image to select it, then drag to move or scroll to resize.
          Values match Printful pixels ({areaWidth}×{areaHeight}).
        </p>
      )}
      <div
        ref={stageRef}
        className={stageClass}
        style={variant === 'overlay' ? undefined : { aspectRatio: `${areaWidth} / ${areaHeight}` }}
        aria-describedby={hideHint ? undefined : hintId}
        data-disabled={disabled ? 'true' : undefined}
      >
        {layers.length === 0 && (
          <div className="placement-canvas-placeholder" aria-hidden>
            <span>Pattern preview</span>
          </div>
        )}

        {orderedLayers.map((layer) => {
          const sClamped = Math.min(1, Math.max(0.05, layer.s))
          const wPrint = areaWidth * sClamped
          const hPrint = areaHeight * sClamped
          const leftPrint = (areaWidth - wPrint) / 2 + layer.dx
          const topPrint = (areaHeight - hPrint) / 2 + layer.dy
          const isSelected = layer.id === effectiveSelectedId

          return (
            <div
              key={layer.id}
              className={`placement-canvas-art${isSelected ? ' placement-canvas-art--selected' : ''}`}
              style={{
                left: leftPrint * displayScale,
                top: topPrint * displayScale,
                width: wPrint * displayScale,
                height: hPrint * displayScale,
                zIndex: isSelected ? 2 : 1,
              }}
              onPointerDown={(e) => handleLayerPointerDown(e, layer)}
              onPointerMove={(e) => handleLayerPointerMove(e, layer, displayScale)}
              onPointerUp={(e) => endDrag(e, layer.id)}
              onPointerCancel={(e) => endDrag(e, layer.id)}
              role="img"
              aria-label={`Image layer${isSelected ? ' (selected)' : ''} — drag to reposition`}
            >
              {layer.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={layer.signedUrl} alt="" className="placement-canvas-img" draggable={false} />
              ) : (
                <div className="placement-canvas-placeholder" aria-hidden>
                  <span>Loading…</span>
                </div>
              )}
              <span className="placement-canvas-art-outline" aria-hidden />
            </div>
          )
        })}
      </div>
    </div>
  )
}
