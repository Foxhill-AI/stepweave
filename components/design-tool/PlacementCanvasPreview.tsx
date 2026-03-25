'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { mergeAndClampPlacement } from '@/lib/designDraftState'

function clampS(s: number): number {
  return Math.min(1, Math.max(0.05, s))
}

export type PlacementCanvasPreviewProps = {
  areaWidth: number
  areaHeight: number
  s: number
  dx: number
  dy: number
  /** Signed URL or public pattern URL; placeholder if missing */
  patternUrl?: string | null
  onChange: (patch: Partial<{ s: number; dx: number; dy: number }>) => void
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
 * Visual print-area preview: drag artwork, scroll wheel to scale.
 * Maps to design_state.printful_placements { s, dx, dy } (same as compactToPrintfulPosition).
 */
export default function PlacementCanvasPreview({
  areaWidth,
  areaHeight,
  s,
  dx,
  dy,
  patternUrl,
  onChange,
  disabled = false,
  variant = 'default',
  hideHint = false,
}: PlacementCanvasPreviewProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [displayScale, setDisplayScale] = useState(1)
  const dragRef = useRef<{ sx: number; sy: number; dx0: number; dy0: number } | null>(null)
  const sRef = useRef(s)
  const dxRef = useRef(dx)
  const dyRef = useRef(dy)
  const onChangeRef = useRef(onChange)
  sRef.current = s
  dxRef.current = dx
  dyRef.current = dy
  onChangeRef.current = onChange

  const emitClamped = useCallback(
    (patch: Partial<{ s: number; dx: number; dy: number }>) => {
      const merged = mergeAndClampPlacement(areaWidth, areaHeight, { s, dx, dy }, patch)
      const out: Partial<{ s: number; dx: number; dy: number }> = {}
      if (merged.s !== s) out.s = merged.s
      if (merged.dx !== dx) out.dx = merged.dx
      if (merged.dy !== dy) out.dy = merged.dy
      if (Object.keys(out).length > 0) onChange(out)
    },
    [areaWidth, areaHeight, s, dx, dy, onChange]
  )

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
  }, [areaWidth, areaHeight])

  useEffect(() => {
    const el = stageRef.current
    if (!el || disabled) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.94 : 1.06
      const nextS = clampS(sRef.current * factor)
      if (Math.abs(nextS - sRef.current) < 1e-6) return
      const merged = mergeAndClampPlacement(
        areaWidth,
        areaHeight,
        { s: nextS, dx: dxRef.current, dy: dyRef.current },
        { s: nextS }
      )
      const out: Partial<{ s: number; dx: number; dy: number }> = {}
      if (merged.s !== sRef.current) out.s = merged.s
      if (merged.dx !== dxRef.current) out.dx = merged.dx
      if (merged.dy !== dyRef.current) out.dy = merged.dy
      if (Object.keys(out).length > 0) onChangeRef.current(out)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [disabled, areaWidth, areaHeight])

  const sClamped = clampS(s)
  const wPrint = areaWidth * sClamped
  const hPrint = areaHeight * sClamped
  const leftPrint = (areaWidth - wPrint) / 2 + dx
  const topPrint = (areaHeight - hPrint) / 2 + dy

  const onArtPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      dragRef.current = { sx: e.clientX, sy: e.clientY, dx0: dx, dy0: dy }
    },
    [disabled, dx, dy]
  )

  const onArtPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || disabled) return
      const d = dragRef.current
      const dPrintX = (e.clientX - d.sx) / displayScale
      const dPrintY = (e.clientY - d.sy) / displayScale
      emitClamped({ dx: d.dx0 + dPrintX, dy: d.dy0 + dPrintY })
    },
    [disabled, displayScale, emitClamped]
  )

  const endDrag = useCallback((e: React.PointerEvent) => {
    dragRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const showImage = Boolean(patternUrl?.trim())
  const stageClass =
    variant === 'overlay'
      ? 'placement-canvas-stage placement-canvas-stage--overlay'
      : 'placement-canvas-stage'
  const hintId = 'placement-canvas-desc'

  return (
    <div className={variant === 'overlay' ? 'placement-canvas-root placement-canvas-root--embedded' : 'placement-canvas-root'}>
      {!hideHint && (
        <p className="placement-canvas-hint" id={hintId}>
          Drag the pattern to move it. Scroll inside the print area to zoom. Values match Printful
          pixels ({areaWidth}×{areaHeight}).
        </p>
      )}
      <div
        ref={stageRef}
        className={stageClass}
        // In overlay mode the stage fills its CSS parent (the print-area box on the
        // template image). Setting aspectRatio here would fight the parent's height and
        // cause the stage to overflow. In default mode we still need aspectRatio to size
        // the standalone canvas correctly.
        style={variant === 'overlay' ? undefined : { aspectRatio: `${areaWidth} / ${areaHeight}` }}
        aria-describedby={hideHint ? undefined : hintId}
        data-disabled={disabled ? 'true' : undefined}
      >
        <div
          className="placement-canvas-art"
          style={{
            left: leftPrint * displayScale,
            top: topPrint * displayScale,
            width: wPrint * displayScale,
            height: hPrint * displayScale,
          }}
          onPointerDown={onArtPointerDown}
          onPointerMove={onArtPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="img"
          aria-label="Pattern in print area — drag to reposition"
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={patternUrl!} alt="" className="placement-canvas-img" draggable={false} />
          ) : (
            <div className="placement-canvas-placeholder" aria-hidden>
              <span>Pattern preview</span>
            </div>
          )}
          <span className="placement-canvas-art-outline" aria-hidden />
        </div>
      </div>
    </div>
  )
}
