'use client'

import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import Moveable from 'react-moveable'
import {
  mergeAndClampPlacement,
  clampImageLayerDxDy,
  clampTextLayerDxDy,
  getImageLayerDimensions,
  estimateTextLayerBox,
  isTextLayer,
  isImageLayer,
} from '@/lib/designDraftState'
import type { ResolvedPlacementLayer, PlacementLayerPatch } from '@/lib/designDraftState'

export type PlacementCanvasPreviewProps = {
  areaWidth: number
  areaHeight: number
  layers: ResolvedPlacementLayer[]
  selectedLayerId?: string | null
  onLayerSelect?: (id: string) => void
  onLayerChange: (layerId: string, patch: PlacementLayerPatch) => void
  /** Remove layer (e.g. × on selection chrome). */
  onLayerDelete?: (layerId: string) => void
  disabled?: boolean
  variant?: 'default' | 'overlay'
  hideHint?: boolean
}

/**
 * Print-area canvas: Moveable handles drag, resize, rotate (pointer + touch).
 * State stays in design_state (dx, dy, w/h or s, rotation).
 */
export default function PlacementCanvasPreview({
  areaWidth,
  areaHeight,
  layers,
  selectedLayerId: externalSelectedId,
  onLayerSelect,
  onLayerChange,
  onLayerDelete,
  disabled = false,
  variant = 'default',
  hideHint = false,
}: PlacementCanvasPreviewProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [moveContainer, setMoveContainer] = useState<HTMLDivElement | null>(null)
  const [displayScale, setDisplayScale] = useState(1)
  const [moveableTarget, setMoveableTarget] = useState<HTMLDivElement | null>(null)

  const effectiveSelectedId =
    layers.length === 1 ? layers[0].id : (externalSelectedId ?? null)

  const layersRef = useRef(layers)
  layersRef.current = layers
  const effectiveSelectedIdRef = useRef(effectiveSelectedId)
  effectiveSelectedIdRef.current = effectiveSelectedId
  const onLayerChangeRef = useRef(onLayerChange)
  onLayerChangeRef.current = onLayerChange

  const stageCallbackRef = useCallback((el: HTMLDivElement | null) => {
    stageRef.current = el
    setMoveContainer(el)
  }, [])

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

  useEffect(() => {
    if (!effectiveSelectedId) setMoveableTarget(null)
  }, [effectiveSelectedId])

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

      if (isTextLayer(layer)) {
        const nextSize = Math.max(10, Math.round(layer.fontSize * factor))
        if (nextSize !== layer.fontSize) {
          const clamped = clampTextLayerDxDy(areaWidth, areaHeight, {
            ...layer,
            fontSize: nextSize,
          })
          const patch: PlacementLayerPatch = { fontSize: nextSize }
          if (clamped.dx !== layer.dx) patch.dx = clamped.dx
          if (clamped.dy !== layer.dy) patch.dy = clamped.dy
          onLayerChangeRef.current(layerId, patch)
        }
      } else {
        const hasWh =
          typeof layer.w === 'number' &&
          typeof layer.h === 'number' &&
          layer.w > 0 &&
          layer.h > 0
        if (hasWh) {
          const { w: cw, h: ch } = getImageLayerDimensions(layer, areaWidth, areaHeight)
          let nw = Math.max(24, Math.round(cw * factor))
          let nh = Math.max(24, Math.round(ch * factor))
          nw = Math.min(Math.round(areaWidth * 1.5), nw)
          nh = Math.min(Math.round(areaHeight * 1.5), nh)
          const c = clampImageLayerDxDy(areaWidth, areaHeight, {
            ...layer,
            w: nw,
            h: nh,
          })
          onLayerChangeRef.current(layerId, { w: nw, h: nh, dx: c.dx, dy: c.dy })
        } else {
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
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [disabled, areaWidth, areaHeight])

  const orderedLayers = useMemo(() => {
    if (!effectiveSelectedId) return layers
    return [
      ...layers.filter((l) => l.id !== effectiveSelectedId),
      ...layers.filter((l) => l.id === effectiveSelectedId),
    ]
  }, [layers, effectiveSelectedId])

  const stageRepeatOverflow = useMemo(
    () => layers.some((l) => isImageLayer(l) && l.repeat === true),
    [layers]
  )

  const baseStageClass =
    variant === 'overlay'
      ? 'placement-canvas-stage placement-canvas-stage--overlay'
      : 'placement-canvas-stage'
  const stageClass = `${baseStageClass}${stageRepeatOverflow ? ' placement-canvas-stage--repeat-overflow' : ''}`
  const hintId = 'placement-canvas-desc'

  const handleSelectPointerDown = useCallback(
    (e: React.PointerEvent, layer: ResolvedPlacementLayer) => {
      if (disabled) return
      if (layer.id === effectiveSelectedIdRef.current) return
      e.stopPropagation()
      onLayerSelect?.(layer.id)
    },
    [disabled, onLayerSelect]
  )

  const selectedLayer = useMemo(
    () => layers.find((l) => l.id === effectiveSelectedId) ?? null,
    [layers, effectiveSelectedId]
  )

  return (
    <div
      className={
        variant === 'overlay'
          ? 'placement-canvas-root placement-canvas-root--embedded'
          : 'placement-canvas-root'
      }
    >
      {!hideHint && (
        <p className="placement-canvas-hint" id={hintId}>
          Select a layer to drag, resize, or rotate. Scroll wheel scales. Printful pixels{' '}
          {areaWidth}×{areaHeight}.
        </p>
      )}
      <div
        ref={stageCallbackRef}
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
          const ds = displayScale > 0 ? displayScale : 1
          const rot = layer.rotation ?? 0
          const pointerPassthrough = isSelected && !disabled ? 'none' as const : undefined

          if (isTextLayer(layer)) {
            const td = clampTextLayerDxDy(areaWidth, areaHeight, layer)
            const { w: tw, h: th } = estimateTextLayerBox(layer.text, layer.fontSize)
            const leftPrint = areaWidth / 2 + td.dx - tw / 2
            const topPrint = areaHeight / 2 + td.dy - th / 2

            return (
              <div
                key={layer.id}
                ref={(el) => {
                  if (layer.id === effectiveSelectedId) setMoveableTarget(el)
                }}
                className={`placement-canvas-text-target placement-canvas-text${
                  isSelected ? ' placement-canvas-art--selected' : ''
                }`}
                style={{
                  position: 'absolute',
                  left: leftPrint * ds,
                  top: topPrint * ds,
                  width: tw * ds,
                  height: th * ds,
                  transform: `rotate(${rot}deg)`,
                  transformOrigin: 'center center',
                  zIndex: isSelected ? 2 : 1,
                  cursor: disabled ? 'default' : isSelected ? 'move' : 'pointer',
                  userSelect: 'none',
                }}
                onPointerDown={(e) => handleSelectPointerDown(e, layer)}
                role="img"
                aria-label={`Text layer: "${layer.text}"${isSelected ? ' (selected)' : ''}`}
              >
                {isSelected && !disabled && onLayerDelete && (
                  <button
                    type="button"
                    className="placement-canvas-delete"
                    aria-label="Remove text layer"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      onLayerDelete(layer.id)
                    }}
                  >
                    ×
                  </button>
                )}
                <div
                  className="placement-canvas-text-inner"
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: pointerPassthrough,
                  }}
                >
                  <span
                    style={{
                      fontSize: layer.fontSize * ds,
                      fontFamily: layer.fontFamily,
                      color: layer.color,
                      whiteSpace: 'nowrap',
                      lineHeight: 1,
                    }}
                  >
                    {layer.text || <span style={{ opacity: 0.4 }}>Text…</span>}
                  </span>
                </div>
                <span className="placement-canvas-art-outline" aria-hidden />
              </div>
            )
          }

          const { w: iw, h: ih } = getImageLayerDimensions(layer, areaWidth, areaHeight)
          const leftPrint = (areaWidth - iw) / 2 + layer.dx
          const topPrint = (areaHeight - ih) / 2 + layer.dy
          const tileRepeat = layer.repeat === true
          const repeatSpan = 2 * Math.max(areaWidth, areaHeight) * ds

          return (
            <div
              key={layer.id}
              ref={(el) => {
                if (layer.id === effectiveSelectedId) setMoveableTarget(el)
              }}
              className={`placement-canvas-art-target placement-canvas-art${
                isSelected ? ' placement-canvas-art--selected' : ''
              }${tileRepeat ? ' placement-canvas-art--repeat' : ''}`}
              style={{
                position: 'absolute',
                left: leftPrint * ds,
                top: topPrint * ds,
                width: iw * ds,
                height: ih * ds,
                transform: `rotate(${rot}deg)`,
                transformOrigin: 'center center',
                zIndex: isSelected ? 2 : 1,
                cursor: disabled ? 'default' : isSelected ? 'move' : 'pointer',
                overflow: tileRepeat ? 'visible' : undefined,
              }}
              onPointerDown={(e) => handleSelectPointerDown(e, layer)}
              role="img"
              aria-label={`Image layer${tileRepeat ? ' (tiled)' : ''}${isSelected ? ' (selected)' : ''}`}
            >
              {isSelected && !disabled && onLayerDelete && (
                <button
                  type="button"
                  className="placement-canvas-delete"
                  aria-label="Remove image layer"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onLayerDelete(layer.id)
                  }}
                >
                  ×
                </button>
              )}
              {layer.signedUrl && tileRepeat ? (
                <div
                  className="placement-canvas-repeat-tiles"
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: `${repeatSpan}px`,
                    height: `${repeatSpan}px`,
                    marginLeft: `${-repeatSpan / 2}px`,
                    marginTop: `${-repeatSpan / 2}px`,
                    backgroundImage: `url(${layer.signedUrl})`,
                    backgroundSize: `${iw * ds}px ${ih * ds}px`,
                    backgroundRepeat: 'repeat',
                    backgroundPosition: 'center center',
                    pointerEvents: 'none',
                  }}
                />
              ) : layer.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={layer.signedUrl}
                  alt=""
                  className="placement-canvas-img"
                  draggable={false}
                  style={{ pointerEvents: pointerPassthrough }}
                />
              ) : (
                <div className="placement-canvas-placeholder" aria-hidden>
                  <span>Loading…</span>
                </div>
              )}
              <span className="placement-canvas-art-outline" aria-hidden />
            </div>
          )
        })}

        {moveableTarget && moveContainer && !disabled && selectedLayer && (
          <Moveable
            target={moveableTarget}
            container={moveContainer}
            origin={false}
            draggable
            resizable
            rotatable
            keepRatio={isTextLayer(selectedLayer)}
            throttleDrag={1}
            renderDirections={['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']}
            rotationPosition="top"
            onDrag={({ left, top }) => {
              const ds = displayScale > 0 ? displayScale : 1
              const leftPrint = left / ds
              const topPrint = top / ds
              if (isTextLayer(selectedLayer)) {
                const { w: tw, h: th } = estimateTextLayerBox(
                  selectedLayer.text,
                  selectedLayer.fontSize
                )
                const dx = leftPrint - (areaWidth - tw) / 2
                const dy = topPrint - (areaHeight - th) / 2
                const c = clampTextLayerDxDy(areaWidth, areaHeight, {
                  ...selectedLayer,
                  dx,
                  dy,
                })
                const patch: PlacementLayerPatch = {}
                if (Math.abs(c.dx - selectedLayer.dx) > 0.25) patch.dx = c.dx
                if (Math.abs(c.dy - selectedLayer.dy) > 0.25) patch.dy = c.dy
                if (Object.keys(patch).length > 0) {
                  onLayerChange(selectedLayer.id, patch)
                }
              } else {
                const { w: iw, h: ih } = getImageLayerDimensions(
                  selectedLayer,
                  areaWidth,
                  areaHeight
                )
                const dx = leftPrint - (areaWidth - iw) / 2
                const dy = topPrint - (areaHeight - ih) / 2
                const c = clampImageLayerDxDy(areaWidth, areaHeight, {
                  ...selectedLayer,
                  dx,
                  dy,
                })
                const patch: PlacementLayerPatch = {}
                if (Math.abs(c.dx - selectedLayer.dx) > 0.25) patch.dx = c.dx
                if (Math.abs(c.dy - selectedLayer.dy) > 0.25) patch.dy = c.dy
                if (Object.keys(patch).length > 0) {
                  onLayerChange(selectedLayer.id, patch)
                }
              }
            }}
            onResize={({ width, height }) => {
              const ds = displayScale > 0 ? displayScale : 1
              const wPrint = Math.max(24, Math.round(width / ds))
              const hPrint = Math.max(24, Math.round(height / ds))
              if (isTextLayer(selectedLayer)) {
                const nextFs = Math.max(
                  10,
                  Math.min(800, Math.round(hPrint / 1.35))
                )
                const c = clampTextLayerDxDy(areaWidth, areaHeight, {
                  ...selectedLayer,
                  fontSize: nextFs,
                })
                onLayerChange(selectedLayer.id, {
                  fontSize: nextFs,
                  dx: c.dx,
                  dy: c.dy,
                })
              } else {
                const c = clampImageLayerDxDy(areaWidth, areaHeight, {
                  ...selectedLayer,
                  w: wPrint,
                  h: hPrint,
                })
                onLayerChange(selectedLayer.id, {
                  w: wPrint,
                  h: hPrint,
                  dx: c.dx,
                  dy: c.dy,
                })
              }
            }}
            onRotate={({ rotation }) => {
              const r = Math.round(rotation * 10) / 10
              if (r !== (selectedLayer.rotation ?? 0)) {
                onLayerChange(selectedLayer.id, { rotation: r })
              }
            }}
          />
        )}
      </div>
    </div>
  )
}
