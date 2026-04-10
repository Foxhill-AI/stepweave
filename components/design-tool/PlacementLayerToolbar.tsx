'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  FlipHorizontal,
  FlipVertical,
  Layers,
  Droplets,
  CopyPlus,
  Trash2,
  MoreHorizontal,
} from 'lucide-react'
import { isImageLayer, type PlacementLayerReorderOp } from '@/lib/designDraftState'
import type { ResolvedPlacementLayer } from '@/lib/designDraftState'

function useModKeyLabel(): string {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent)
    ? '\u2318'
    : 'Ctrl'
}

export type PlacementLayerToolbarProps = {
  selectedLayer: ResolvedPlacementLayer | null
  layerIndex: number
  layerCount: number
  /** Anchor box in CSS px, relative to the placement stage (offsetParent) */
  anchor: { left: number; top: number; width: number; height: number } | null
  /** Horizontal center for the bar (px), clamped to stage — keeps toolbar visible */
  centerX: number
  disabled?: boolean
  onFlip: (axis: 'h' | 'v') => void
  onOpacityChange: (opacity01: number) => void
  onReorder?: (op: PlacementLayerReorderOp) => void
  onDuplicate?: () => void
  onDelete?: () => void
  onCopy?: () => void
  onRepeatToggle?: (next: boolean) => void
}

type PopoverId = 'flip' | 'opacity' | 'position' | 'more' | null

export default function PlacementLayerToolbar({
  selectedLayer,
  layerIndex,
  layerCount,
  anchor,
  centerX,
  disabled = false,
  onFlip,
  onOpacityChange,
  onReorder,
  onDuplicate,
  onDelete,
  onCopy,
  onRepeatToggle,
}: PlacementLayerToolbarProps) {
  const mod = useModKeyLabel()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<PopoverId>(null)

  const close = useCallback(() => setOpen(null), [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current
      if (el && !el.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [open, close])

  if (!selectedLayer || !anchor || disabled) return null

  const isImage = isImageLayer(selectedLayer)
  const flipH = selectedLayer.flipH === true
  const flipV = selectedLayer.flipV === true
  const opacity01 =
    typeof selectedLayer.opacity === 'number' && Number.isFinite(selectedLayer.opacity)
      ? Math.min(1, Math.max(0, selectedLayer.opacity))
      : 1
  const repeatOn = isImage && selectedLayer.repeat === true

  const canReorder = Boolean(onReorder)
  const canForward = canReorder && layerIndex < layerCount - 1
  const canBackward = canReorder && layerIndex > 0

  const barLeft = centerX
  const barTop = anchor.top + anchor.height + 4

  const run = (fn: () => void) => {
    fn()
    close()
  }

  return (
    <div
      ref={rootRef}
      className="placement-layer-toolbar"
      style={{
        left: barLeft,
        top: barTop,
      }}
      role="toolbar"
      aria-label="Layer tools"
    >
      <div className="placement-layer-toolbar__inner">
        <div className="placement-layer-toolbar__group">
          <button
            type="button"
            className={`placement-layer-toolbar__btn placement-layer-toolbar__btn--split${open === 'flip' ? ' placement-layer-toolbar__btn--active' : ''}`}
            aria-expanded={open === 'flip'}
            aria-label="Flip"
            title="Flip"
            onClick={() => setOpen((v) => (v === 'flip' ? null : 'flip'))}
          >
            <span className="placement-layer-toolbar__btn-icon" aria-hidden>
              <FlipHorizontal size={11} strokeWidth={2.25} />
            </span>
          </button>
          {open === 'flip' && (
            <div className="placement-layer-toolbar__popover" role="menu">
              <button
                type="button"
                role="menuitem"
                className={flipH ? 'is-on' : undefined}
                onClick={() => run(() => onFlip('h'))}
              >
                <FlipHorizontal size={12} aria-hidden />
                <span>Flip horizontal</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={flipV ? 'is-on' : undefined}
                onClick={() => run(() => onFlip('v'))}
              >
                <FlipVertical size={12} aria-hidden />
                <span>Flip vertical</span>
              </button>
            </div>
          )}
        </div>

        <span className="placement-layer-toolbar__sep" aria-hidden />

        <div className="placement-layer-toolbar__group">
          <button
            type="button"
            className={`placement-layer-toolbar__btn placement-layer-toolbar__btn--split${open === 'opacity' ? ' placement-layer-toolbar__btn--active' : ''}`}
            aria-expanded={open === 'opacity'}
            aria-label="Opacity"
            title="Opacity / transparency"
            onClick={() => setOpen((v) => (v === 'opacity' ? null : 'opacity'))}
          >
            <span className="placement-layer-toolbar__btn-icon" aria-hidden>
              <Droplets size={11} strokeWidth={2.25} />
            </span>
          </button>
          {open === 'opacity' && (
            <div className="placement-layer-toolbar__popover placement-layer-toolbar__popover--wide" role="menu">
              <label className="placement-layer-toolbar__slider-label">
                Opacity {Math.round(opacity01 * 100)}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(opacity01 * 100)}
                  onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
                />
              </label>
            </div>
          )}
        </div>

        <span className="placement-layer-toolbar__sep" aria-hidden />

        <div className="placement-layer-toolbar__group">
          <button
            type="button"
            className={`placement-layer-toolbar__btn placement-layer-toolbar__btn--split${open === 'position' ? ' placement-layer-toolbar__btn--active' : ''}`}
            aria-expanded={open === 'position'}
            disabled={!canReorder}
            aria-label="Layer order"
            title={!canReorder ? 'Layer order not available' : 'Layer order (front / back)'}
            onClick={() => canReorder && setOpen((v) => (v === 'position' ? null : 'position'))}
          >
            <span className="placement-layer-toolbar__btn-icon" aria-hidden>
              <Layers size={11} strokeWidth={2.25} />
            </span>
          </button>
          {open === 'position' && (
            <div className="placement-layer-toolbar__popover" role="menu">
              <button
                type="button"
                role="menuitem"
                disabled={!canForward}
                onClick={() => run(() => onReorder?.('forward'))}
              >
                Bring forward <kbd className="placement-layer-toolbar__kbd">]</kbd>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!canBackward}
                onClick={() => run(() => onReorder?.('backward'))}
              >
                Send backward
                <kbd className="placement-layer-toolbar__kbd">[</kbd>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!canForward}
                onClick={() => run(() => onReorder?.('front'))}
              >
                Bring to front
                <kbd className="placement-layer-toolbar__kbd">{mod}+Shift+]</kbd>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!canBackward}
                onClick={() => run(() => onReorder?.('back'))}
              >
                Send to back
                <kbd className="placement-layer-toolbar__kbd">{mod}+Shift+[</kbd>
              </button>
            </div>
          )}
        </div>

        <span className="placement-layer-toolbar__sep" aria-hidden />

        {onDuplicate && (
          <button
            type="button"
            className="placement-layer-toolbar__icon-btn"
            aria-label="Duplicate"
            title={`Duplicate (${mod}+D)`}
            onClick={onDuplicate}
          >
            <CopyPlus size={11} strokeWidth={2.25} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="placement-layer-toolbar__icon-btn placement-layer-toolbar__icon-btn--danger"
            aria-label="Delete"
            title="Delete"
            onClick={onDelete}
          >
            <Trash2 size={11} strokeWidth={2.25} />
          </button>
        )}

        <div className="placement-layer-toolbar__group">
          <button
            type="button"
            className={`placement-layer-toolbar__icon-btn${open === 'more' ? ' placement-layer-toolbar__btn--active' : ''}`}
            aria-label="More options"
            aria-expanded={open === 'more'}
            onClick={() => setOpen((v) => (v === 'more' ? null : 'more'))}
          >
            <MoreHorizontal size={12} strokeWidth={2.25} />
          </button>
          {open === 'more' && (
            <div
              className="placement-layer-toolbar__popover placement-layer-toolbar__popover--menu placement-layer-toolbar__popover--right"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onFlip('h'))}
              >
                Flip horizontal
                <kbd className="placement-layer-toolbar__kbd">{mod}+Shift+H</kbd>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(() => onFlip('v'))}
              >
                Flip vertical
                <kbd className="placement-layer-toolbar__kbd">{mod}+Shift+V</kbd>
              </button>
              <div className="placement-layer-toolbar__menu-slider" role="menuitem" onClick={(e) => e.stopPropagation()}>
                <span>Transparency</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(opacity01 * 100)}
                  onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
                />
              </div>
              <button
                type="button"
                role="menuitem"
                disabled={!canForward}
                onClick={() => run(() => onReorder?.('forward'))}
              >
                Bring forward
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!canBackward}
                onClick={() => run(() => onReorder?.('backward'))}
              >
                Send backward
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!canForward}
                onClick={() => run(() => onReorder?.('front'))}
              >
                Bring to front
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!canBackward}
                onClick={() => run(() => onReorder?.('back'))}
              >
                Send to back
              </button>
              {isImage && onRepeatToggle && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => run(() => onRepeatToggle(!repeatOn))}
                >
                  {repeatOn ? 'Turn off tile / repeat' : 'Tile / repeat to fill area'}
                </button>
              )}
              {onCopy && (
                <button type="button" role="menuitem" onClick={() => run(() => onCopy())}>
                  Copy
                  <kbd className="placement-layer-toolbar__kbd">{mod}+C</kbd>
                </button>
              )}
              {onDuplicate && (
                <button type="button" role="menuitem" onClick={() => run(() => onDuplicate())}>
                  Duplicate
                  <kbd className="placement-layer-toolbar__kbd">{mod}+D</kbd>
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  role="menuitem"
                  className="placement-layer-toolbar__menu-danger"
                  onClick={() => run(() => onDelete())}
                >
                  Delete
                  <kbd className="placement-layer-toolbar__kbd">Del</kbd>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
