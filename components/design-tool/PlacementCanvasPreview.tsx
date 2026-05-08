'use client'

import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import type { MutableRefObject } from 'react'
import Moveable from 'react-moveable'
import {
  mergeAndClampPlacement,
  clampImageLayerDxDy,
  clampTextLayerDxDy,
  getImageLayerDimensions,
  estimateTextLayerBox,
  isTextLayer,
  isImageLayer,
  placementLayerToSerializable,
} from '@/lib/designDraftState'
import type {
  ResolvedPlacementLayer,
  PlacementLayerPatch,
  PlacementLayer,
  PlacementLayerReorderOp,
} from '@/lib/designDraftState'
import PlacementLayerToolbar from './PlacementLayerToolbar'

export type PlacementCanvasPreviewProps = {
  areaWidth: number
  areaHeight: number
  layers: ResolvedPlacementLayer[]
  selectedLayerId?: string | null
  onLayerSelect?: (id: string) => void
  onLayerChange: (layerId: string, patch: PlacementLayerPatch) => void
  /** Remove layer (toolbar trash / shortcuts). */
  onLayerDelete?: (layerId: string) => void
  /** Change stacking order (array index: higher = on top). */
  onLayerReorder?: (layerId: string, op: PlacementLayerReorderOp) => void
  /** Clone selected layer after itself. */
  onLayerDuplicate?: (layerId: string) => void
  /** Append a layer from clipboard (e.g. Cmd+V). */
  onPasteLayer?: (layer: PlacementLayer) => void
  /** Holds last copied layer for paste; updated on Cmd+C. */
  layerClipboardRef?: MutableRefObject<PlacementLayer | null>
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
  onLayerReorder,
  onLayerDuplicate,
  onPasteLayer,
  layerClipboardRef,
  disabled = false,
  variant = 'default',
  hideHint = false,
}: PlacementCanvasPreviewProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [moveContainer, setMoveContainer] = useState<HTMLDivElement | null>(null)
  const [displayScale, setDisplayScale] = useState(1)
  const [stageClientWidth, setStageClientWidth] = useState(0)
  const [moveableTarget, setMoveableTarget] = useState<HTMLDivElement | null>(null)

  const effectiveSelectedId =
    layers.length === 1 ? layers[0].id : (externalSelectedId ?? null)

  const layersRef = useRef(layers)
  layersRef.current = layers
  const effectiveSelectedIdRef = useRef(effectiveSelectedId)
  effectiveSelectedIdRef.current = effectiveSelectedId
  const onLayerChangeRef = useRef(onLayerChange)
  onLayerChangeRef.current = onLayerChange
  const onLayerReorderRef = useRef(onLayerReorder)
  onLayerReorderRef.current = onLayerReorder
  const onLayerDuplicateRef = useRef(onLayerDuplicate)
  onLayerDuplicateRef.current = onLayerDuplicate
  const onLayerDeleteRef = useRef(onLayerDelete)
  onLayerDeleteRef.current = onLayerDelete
  const onPasteLayerRef = useRef(onPasteLayer)
  onPasteLayerRef.current = onPasteLayer
  const layerClipboardRefRef = useRef(layerClipboardRef)
  layerClipboardRefRef.current = layerClipboardRef

  const stageCallbackRef = useCallback((el: HTMLDivElement | null) => {
    stageRef.current = el
    setMoveContainer(el)
  }, [])

  useEffect(() => {
    const el = stageRef.current
    if (!el || areaWidth <= 0) return
    const update = () => {
      const w = el.clientWidth
      if (w > 0) {
        setDisplayScale(w / areaWidth)
        setStageClientWidth(w)
      }
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

  const baseStageClass =
    variant === 'overlay'
      ? 'placement-canvas-stage placement-canvas-stage--overlay'
      : 'placement-canvas-stage'
  const stageClass = baseStageClass
  const hintId = 'placement-canvas-desc'

  const handleSelectPointerDown = useCallback(
    (e: React.PointerEvent, layer: ResolvedPlacementLayer) => {
      stageRef.current?.focus({ preventScroll: true })
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

  const toolbarAnchor = useMemo(() => {
    if (!selectedLayer || disabled) return null
    const ds = displayScale > 0 ? displayScale : 1
    if (isTextLayer(selectedLayer)) {
      const td = clampTextLayerDxDy(areaWidth, areaHeight, selectedLayer)
      const { w: tw, h: th } = estimateTextLayerBox(selectedLayer.text, selectedLayer.fontSize)
      const leftPrint = areaWidth / 2 + td.dx - tw / 2
      const topPrint = areaHeight / 2 + td.dy - th / 2
      return { left: leftPrint * ds, top: topPrint * ds, width: tw * ds, height: th * ds }
    }
    const { w: iw, h: ih } = getImageLayerDimensions(selectedLayer, areaWidth, areaHeight)
    const leftPrint = (areaWidth - iw) / 2 + selectedLayer.dx
    const topPrint = (areaHeight - ih) / 2 + selectedLayer.dy
    return { left: leftPrint * ds, top: topPrint * ds, width: iw * ds, height: ih * ds }
  }, [selectedLayer, disabled, displayScale, areaWidth, areaHeight])

  const layerStackIndex = useMemo(() => {
    if (!effectiveSelectedId) return -1
    return layers.findIndex((l) => l.id === effectiveSelectedId)
  }, [layers, effectiveSelectedId])

  /** Keep toolbar centered on the layer but inside the stage. */
  const toolbarCenterX = useMemo(() => {
    if (!toolbarAnchor) return 0
    const cx = toolbarAnchor.left + toolbarAnchor.width / 2
    const sw = stageClientWidth
    if (sw <= 0) return cx
    const m = 3
    const half = Math.min(64, Math.max(28, sw * 0.16))
    const lo = half + m
    const hi = sw - half - m
    if (hi <= lo) return sw / 2
    return Math.min(Math.max(cx, lo), hi)
  }, [toolbarAnchor, stageClientWidth])

  useEffect(() => {
    if (disabled) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('.placement-layer-toolbar')) return
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
      if (t?.isContentEditable) return

      const stage = stageRef.current
      if (!stage) return
      const ae = document.activeElement as HTMLElement | null
      if (ae !== stage && !ae?.closest?.('.placement-canvas-stage')) return

      const id = effectiveSelectedIdRef.current
      if (!id) return
      const layer = layersRef.current.find((l) => l.id === id)
      if (!layer) return

      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key.toLowerCase() === 'c') {
        const ref = layerClipboardRefRef.current
        if (ref) {
          ref.current = placementLayerToSerializable(layer)
          e.preventDefault()
        }
        return
      }
      if (mod && e.key.toLowerCase() === 'v') {
        const ref = layerClipboardRefRef.current
        const paste = onPasteLayerRef.current
        const clip = ref?.current
        if (clip && paste) {
          e.preventDefault()
          paste(clip)
        }
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        const d = onLayerDuplicateRef.current
        if (d) {
          e.preventDefault()
          d(id)
        }
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const del = onLayerDeleteRef.current
        if (del) {
          e.preventDefault()
          del(id)
        }
        return
      }
      if (mod && e.shiftKey && (e.key === ']' || e.code === 'BracketRight')) {
        onLayerReorderRef.current?.(id, 'front')
        e.preventDefault()
        return
      }
      if (mod && e.shiftKey && (e.key === '[' || e.code === 'BracketLeft')) {
        onLayerReorderRef.current?.(id, 'back')
        e.preventDefault()
        return
      }
      if (!mod && e.key === ']' && !e.shiftKey) {
        onLayerReorderRef.current?.(id, 'forward')
        e.preventDefault()
        return
      }
      if (!mod && e.key === '[' && !e.shiftKey) {
        onLayerReorderRef.current?.(id, 'backward')
        e.preventDefault()
        return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'h') {
        onLayerChangeRef.current(id, {
          flipH: !((layer as { flipH?: boolean }).flipH === true),
        })
        e.preventDefault()
        return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'v') {
        onLayerChangeRef.current(id, {
          flipV: !((layer as { flipV?: boolean }).flipV === true),
        })
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [disabled])

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
        tabIndex={disabled ? undefined : 0}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.focus({ preventScroll: true })
        }}
      >
        {layers.length === 0 && (
          <div className="placement-canvas-placeholder" aria-hidden>
            <span>Pattern preview</span>
          </div>
        )}

        {/* Stage-filling repeat backgrounds — rendered before layer divs, clipped by stage */}
        {layers.map((layer) => {
          if (!isImageLayer(layer) || !layer.repeat || !layer.signedUrl) return null
          const ds = displayScale > 0 ? displayScale : 1
          const { w: iw, h: ih } = getImageLayerDimensions(layer, areaWidth, areaHeight)
          const leftPrint = (areaWidth - iw) / 2 + layer.dx
          const topPrint = (areaHeight - ih) / 2 + layer.dy
          const baseOp =
            typeof (layer as { opacity?: number }).opacity === 'number'
              ? Math.min(1, Math.max(0, (layer as { opacity?: number }).opacity!))
              : 1
          const isSelected = layer.id === effectiveSelectedId
          const op = isSelected ? baseOp : baseOp * 0.85
          return (
            <div
              key={`repeat-bg-${layer.id}`}
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${layer.signedUrl})`,
                backgroundSize: `${iw * ds}px ${ih * ds}px`,
                backgroundRepeat: 'repeat',
                backgroundPosition: `${leftPrint * ds}px ${topPrint * ds}px`,
                opacity: op,
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />
          )
        })}

        {orderedLayers.map((layer) => {
          const isSelected = layer.id === effectiveSelectedId
          const ds = displayScale > 0 ? displayScale : 1
          const rot = layer.rotation ?? 0
          const fh = (layer as { flipH?: boolean }).flipH === true ? -1 : 1
          const fv = (layer as { flipV?: boolean }).flipV === true ? -1 : 1
          const baseOp =
            typeof (layer as { opacity?: number }).opacity === 'number'
              ? Math.min(1, Math.max(0, (layer as { opacity?: number }).opacity!))
              : 1
          const op = isSelected ? baseOp : baseOp * 0.85
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
                  transform: `rotate(${rot}deg) scaleX(${fh}) scaleY(${fv})`,
                  transformOrigin: 'center center',
                  zIndex: isSelected ? 2 : 1,
                  cursor: disabled ? 'default' : isSelected ? 'move' : 'pointer',
                  userSelect: 'none',
                  opacity: op,
                }}
                onPointerDown={(e) => handleSelectPointerDown(e, layer)}
                role="img"
                aria-label={`Text layer: "${layer.text}"${isSelected ? ' (selected)' : ''}`}
              >
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
                transform: `rotate(${rot}deg) scaleX(${fh}) scaleY(${fv})`,
                transformOrigin: 'center center',
                zIndex: tileRepeat ? 2 : isSelected ? 2 : 1,
                cursor: disabled ? 'default' : isSelected ? 'move' : 'pointer',
                opacity: tileRepeat && !isSelected ? 0 : op,
              }}
              onPointerDown={(e) => handleSelectPointerDown(e, layer)}
              role="img"
              aria-label={`Image layer${tileRepeat ? ' (tiled)' : ''}${isSelected ? ' (selected)' : ''}`}
            >
              {!tileRepeat && layer.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={layer.signedUrl}
                  alt=""
                  className="placement-canvas-img"
                  draggable={false}
                  style={{ pointerEvents: pointerPassthrough }}
                />
              ) : !tileRepeat ? (
                <div className="placement-canvas-placeholder" aria-hidden>
                  <span>Loading…</span>
                </div>
              ) : null}
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
            keepRatio={true}
            throttleDrag={0}
            renderDirections={['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']}
            rotationPosition="top"
            onDrag={({ target, left, top }) => {
              // Synchronous DOM update for smooth Moveable handle tracking
              target.style.left = `${left}px`
              target.style.top = `${top}px`
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
            onResize={({ target, width, height }) => {
              // Synchronous DOM update so handles track immediately
              target.style.width = `${width}px`
              target.style.height = `${height}px`
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

        {effectiveSelectedId &&
 selectedLayer &&
          toolbarAnchor &&
          !disabled &&
          onLayerDelete && (
            <div
              className="placement-layer-toolbar-wrap"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <PlacementLayerToolbar
                selectedLayer={selectedLayer}
                layerIndex={layerStackIndex}
                layerCount={layers.length}
                anchor={toolbarAnchor}
                centerX={toolbarCenterX}
                disabled={disabled}
                onFlip={(axis) => {
                  if (axis === 'h') {
                    onLayerChange(effectiveSelectedId, {
                      flipH: !((selectedLayer as { flipH?: boolean }).flipH === true),
                    })
                  } else {
                    onLayerChange(effectiveSelectedId, {
                      flipV: !((selectedLayer as { flipV?: boolean }).flipV === true),
                    })
                  }
                }}
                onOpacityChange={(v) => onLayerChange(effectiveSelectedId, { opacity: v })}
                onReorder={(op) => onLayerReorder?.(effectiveSelectedId, op)}
                onDuplicate={() => onLayerDuplicate?.(effectiveSelectedId)}
                onDelete={() => onLayerDelete(effectiveSelectedId)}
                onCopy={
                  layerClipboardRef
                    ? () => {
                        layerClipboardRef.current = placementLayerToSerializable(selectedLayer)
                      }
                    : undefined
                }
                onRepeatToggle={
                  isImageLayer(selectedLayer)
                    ? (next) => onLayerChange(effectiveSelectedId, { repeat: next })
                    : undefined
                }
              />
            </div>
          )}
      </div>
    </div>
  )
}
