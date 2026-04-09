'use client'

import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import {
  mergeAndClampPlacement,
  clampTextDxDyInPrintArea,
  isTextLayer,
  isImageLayer,
} from '@/lib/designDraftState'
import type { ResolvedPlacementLayer, PlacementLayerPatch } from '@/lib/designDraftState'

export type PlacementCanvasPreviewProps = {
  areaWidth: number
  areaHeight: number
  /** Layers to render (image + text). Each layer has its own position. */
  layers: ResolvedPlacementLayer[]
  /** ID of the currently selected layer. Auto-selects the only layer when there is exactly one. */
  selectedLayerId?: string | null
  onLayerSelect?: (id: string) => void
  onLayerChange: (layerId: string, patch: PlacementLayerPatch) => void
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
 * Visual print-area canvas: drag/scroll each layer independently.
 * Image layers: scroll changes scale, drag repositions.
 * Text layers: scroll changes fontSize, drag repositions.
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

  // Wheel → scale image layer / change fontSize for text layer
  useEffect(() => {
    const el = stageRef.current
    if (!el || disabled) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const layerId = effectiveSelectedIdRef.current
      if (!layerId) return
      const layer = layersRef.current.find((l) => l.id === layerId)
      if (!layer) return

      if (isTextLayer(layer)) {
        // Scroll changes fontSize for text layers; re-clamp dx/dy (padding depends on font size)
        const factor = e.deltaY > 0 ? 0.94 : 1.06
        const nextSize = Math.max(10, Math.round(layer.fontSize * factor))
        if (nextSize !== layer.fontSize) {
          const clamped = clampTextDxDyInPrintArea(
            areaWidth,
            areaHeight,
            layer.dx,
            layer.dy,
            nextSize
          )
          const patch: PlacementLayerPatch = { fontSize: nextSize }
          if (clamped.dx !== layer.dx) patch.dx = clamped.dx
          if (clamped.dy !== layer.dy) patch.dy = clamped.dy
          onLayerChangeRef.current(layerId, patch)
        }
      } else {
        // Scroll changes scale for image layers
        const factor = e.deltaY > 0 ? 0.94 : 1.06
        const nextS = Math.min(1, Math.max(0.05, layer.s * factor))
        if (Math.abs(nextS - layer.s) < 1e-6) return
        const merged = mergeAndClampPlacement(
          areaWidth,
          areaHeight,
          { s: nextS, dx: layer.dx, dy: layer.dy },
          { s: nextS }
        )
        const out: PlacementLayerPatch = {}
        if (merged.s !== layer.s) out.s = merged.s
        if (merged.dx !== layer.dx) out.dx = merged.dx
        if (merged.dy !== layer.dy) out.dy = merged.dy
        if (Object.keys(out).length > 0) onLayerChangeRef.current(layerId, out)
      }
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
    (e: React.PointerEvent, layer: ResolvedPlacementLayer) => {
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
    (e: React.PointerEvent, layer: ResolvedPlacementLayer, ds: number) => {
      if (!dragRef.current || dragRef.current.layerId !== layer.id || disabled) return
      const d = dragRef.current
      const dPrintX = (e.clientX - d.sx) / ds
      const dPrintY = (e.clientY - d.sy) / ds
      const newDx = d.dx0 + dPrintX
      const newDy = d.dy0 + dPrintY

      const out: PlacementLayerPatch = {}
      if (isImageLayer(layer)) {
        // Clamp image layers within print area
        const merged = mergeAndClampPlacement(
          areaWidth,
          areaHeight,
          { s: layer.s, dx: newDx, dy: newDy },
          { dx: newDx, dy: newDy }
        )
        if (merged.dx !== layer.dx) out.dx = merged.dx
        if (merged.dy !== layer.dy) out.dy = merged.dy
      } else {
        const merged = clampTextDxDyInPrintArea(
          areaWidth,
          areaHeight,
          newDx,
          newDy,
          layer.fontSize
        )
        if (Math.abs(merged.dx - layer.dx) > 0.5) out.dx = merged.dx
        if (Math.abs(merged.dy - layer.dy) > 0.5) out.dy = merged.dy
      }
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
          Click a layer to select it, then drag to move or scroll to resize.
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
          const isSelected = layer.id === effectiveSelectedId

          if (isTextLayer(layer)) {
            // Same bounds as server composite (clampTextDxDyInPrintArea)
            const td = clampTextDxDyInPrintArea(
              areaWidth,
              areaHeight,
              layer.dx,
              layer.dy,
              layer.fontSize
            )
            const centerX = (areaWidth / 2 + td.dx) * displayScale
            const centerY = (areaHeight / 2 + td.dy) * displayScale
            const fontSizeDisplay = layer.fontSize * displayScale
            return (
              <div
                key={layer.id}
                className={`placement-canvas-text${isSelected ? ' placement-canvas-art--selected' : ''}`}
                style={{
                  position: 'absolute',
                  left: centerX,
                  top: centerY,
                  transform: 'translate(-50%, -50%)',
                  fontSize: fontSizeDisplay,
                  fontFamily: layer.fontFamily,
                  color: layer.color,
                  whiteSpace: 'nowrap',
                  cursor: 'move',
                  userSelect: 'none',
                  zIndex: isSelected ? 2 : 1,
                  lineHeight: 1,
                }}
                onPointerDown={(e) => handleLayerPointerDown(e, layer)}
                onPointerMove={(e) => handleLayerPointerMove(e, layer, displayScale)}
                onPointerUp={(e) => endDrag(e, layer.id)}
                onPointerCancel={(e) => endDrag(e, layer.id)}
                role="img"
                aria-label={`Text layer: "${layer.text}"${isSelected ? ' (selected)' : ''} — drag to reposition`}
              >
                {layer.text || <span style={{ opacity: 0.4 }}>Text…</span>}
                <span className="placement-canvas-art-outline" aria-hidden />
              </div>
            )
          }

          // Image layer
          const sClamped = Math.min(1, Math.max(0.05, layer.s))
          const wPrint = areaWidth * sClamped
          const hPrint = areaHeight * sClamped
          const leftPrint = (areaWidth - wPrint) / 2 + layer.dx
          const topPrint = (areaHeight - hPrint) / 2 + layer.dy

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
