'use client'

import { useState, useRef, useEffect, type MutableRefObject } from 'react'
import { Upload, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import ShoeDesignEditor from './ShoeDesignEditor'
import type { PlacementTemplateRow } from '@/lib/printful/placementTemplate'
import type {
  ResolvedPlacementLayer,
  PlacementLayerPatch,
  PlacementTextLayer,
  PlacementLayer,
  PlacementLayerReorderOp,
} from '@/lib/designDraftState'
import { FONTS } from '@/lib/fonts'

const ACCEPT_IMAGES = 'image/*'
const MAX_SIZE_MB = 10
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
const BUCKET = 'design-patterns'

export type MockupExtraItem = {
  title: string
  mockup_url: string
}

/** One placement from Printful mockups (dynamic tabs). */
export type PlacementTab = {
  placement: string
  label: string
  mockup_url: string
  extra_mockups?: MockupExtraItem[]
}

interface PreviewWorkspaceProps {
  /** Dynamic mockup per placement (same variant). When set, tabs follow these. */
  placementMockups?: PlacementTab[] | null
  /** Catalog image when mockups are loading or failed. */
  catalogFallbackUrl?: string | null
  /** True when API returned placements but no mockup URLs (catalog used per tab). */
  catalogOnlyReference?: boolean
  selectedModelName?: string | null
  mockupImagesLoading?: boolean
  draftId?: number
  authUserId?: string | null
  onImageSelect?: (imageUrl: string) => void
  onPatternUploaded?: (path: string, localUrl?: string) => void
  imageUrl?: string | null
  onImageClear?: () => void
  /** Template rows from Printful for shoe canvas display. */
  templateRows?: PlacementTemplateRow[]
  templatesLoading?: boolean
  /** Controlled active placement for shoe editor */
  activePlacement?: string
  onActivePlacementChange?: (placement: string) => void
  /** Layers for the active placement (image + text, resolved). */
  activeLayers?: ResolvedPlacementLayer[]
  selectedLayerId?: string | null
  onLayerSelect?: (id: string) => void
  onLayerChange?: (layerId: string, patch: PlacementLayerPatch) => void
  onLayerDelete?: (layerId: string) => void
  onLayerReorder?: (layerId: string, op: PlacementLayerReorderOp) => void
  onLayerDuplicate?: (layerId: string) => void
  onPasteLayer?: (layer: PlacementLayer) => void
  layerClipboardRef?: MutableRefObject<PlacementLayer | null>
  /** Called when the user adds a new text layer. */
  onAddTextLayer?: (layer: PlacementTextLayer) => void
  /** Placement layout actions — rendered contextually below the shoe canvas */
  onSaveLayout?: () => Promise<void>
  onRefreshPrintfulPreview?: () => Promise<void>
  saveLoading?: boolean
  previewLoading?: boolean
  hasPatternImage?: boolean
  /** True after the user has generated at least one preview — changes button label. */
  hasGeneratedMockups?: boolean
}

function getExtension(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i >= 0 ? filename.slice(i) : '.png'
}

export default function PreviewWorkspace({
  placementMockups,
  catalogFallbackUrl,
  catalogOnlyReference,
  selectedModelName,
  mockupImagesLoading,
  draftId,
  authUserId,
  onImageSelect,
  onPatternUploaded,
  imageUrl,
  onImageClear,
  templateRows,
  templatesLoading: _templatesLoading,
  activePlacement: externalActivePlacement,
  onActivePlacementChange,
  activeLayers = [],
  selectedLayerId,
  onLayerSelect,
  onLayerChange,
  onLayerDelete,
  onLayerReorder,
  onLayerDuplicate,
  onPasteLayer,
  layerClipboardRef,
  onAddTextLayer,
  onSaveLayout,
  onRefreshPrintfulPreview,
  saveLoading = false,
  previewLoading = false,
  hasPatternImage = false,
  hasGeneratedMockups = false,
}: PreviewWorkspaceProps) {
  const tabs = placementMockups?.length ? placementMockups : null
  // Index into the unified photo gallery (0 = first photo)
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  // 'canvas' = shoe template editor, 'mockups' = generated mockup images
  const [viewMode, setViewMode] = useState<'canvas' | 'mockups'>('canvas')
  // True when layers changed after the last preview generation
  const [isDirty, setIsDirty] = useState(false)
  // Text layer add panel
  const [showTextPanel, setShowTextPanel] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [textFont, setTextFont] = useState(FONTS[0].value)
  const [textColor, setTextColor] = useState('#000000')
  const [textSize, setTextSize] = useState(120)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prevPreviewLoadingRef = useRef(previewLoading)
  const prevHadImageRef = useRef(false)
  const prevActiveLayerCountRef = useRef(0)
  const prevLayersJsonRef = useRef('')

  const handleRefreshPreview = async () => {
    if (!onRefreshPrintfulPreview) return
    try {
      await onRefreshPrintfulPreview()
    } catch {
      // error handled by parent
    }
  }

  // Smart preview button: show existing mockups if clean, regenerate if dirty or none exist
  const handlePreviewClick = async () => {
    const hasMockups = Boolean(tabs?.some((t) => t.mockup_url?.trim()))
    if (hasMockups && !isDirty) {
      setViewMode('mockups')
    } else {
      await handleRefreshPreview()
      // viewMode switches to 'mockups' in the effect below when loading finishes
    }
  }

  useEffect(() => {
    setActiveGalleryIndex(0)
  }, [tabs])

  // Track layer changes to know if preview is stale
  useEffect(() => {
    const json = JSON.stringify(activeLayers)
    if (prevLayersJsonRef.current !== '' && json !== prevLayersJsonRef.current) {
      setIsDirty(true)
    }
    prevLayersJsonRef.current = json
  }, [activeLayers])

  // Switch to mockups view when a preview run finishes; clear dirty flag
  useEffect(() => {
    const wasLoading = prevPreviewLoadingRef.current
    prevPreviewLoadingRef.current = previewLoading
    if (wasLoading && !previewLoading) {
      const hasRealMockups = placementMockups?.some((t) => t.mockup_url?.trim())
      if (hasRealMockups) {
        setViewMode('mockups')
        setIsDirty(false)
      }
    }
  }, [previewLoading, placementMockups])

  // After upload / new layer, show template editor
  useEffect(() => {
    const hasImage =
      activeLayers.length > 0 || Boolean(imageUrl?.trim()) || Boolean(hasPatternImage)
    const n = activeLayers.length
    const gainedFirstImage = !prevHadImageRef.current && hasImage
    const addedLayer = n > prevActiveLayerCountRef.current && n > 0
    if (gainedFirstImage || addedLayer) {
      setViewMode('canvas')
    }
    prevHadImageRef.current = hasImage
    prevActiveLayerCountRef.current = n
  }, [activeLayers.length, imageUrl, hasPatternImage])

  useEffect(() => {
    if (!mockupImagesLoading) {
      setLoadingPhase(0)
      return
    }
    setLoadingPhase(0)
    const t1 = setTimeout(() => setLoadingPhase(1), 10000)
    const t2 = setTimeout(() => setLoadingPhase(2), 20000)
    const t3 = setTimeout(() => setLoadingPhase(3), 30000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [mockupImagesLoading])

  const LOADING_MESSAGES = [
    'Working on your mockups…',
    'Almost there…',
    'Just a moment more…',
  ]

  const useStorageUpload = Boolean(draftId && authUserId && onPatternUploaded)

  // Shoe canvas computations — use templateRows passed from parent
  const templateWithUrl = templateRows?.filter((r) => r.template_url?.trim()) ?? []
  const useShoeCanvas = templateWithUrl.length > 0

  const handleFile = async (file: File | null) => {
    setUploadError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file (e.g. JPG, PNG, WebP).')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError(`Image must be under ${MAX_SIZE_MB} MB.`)
      return
    }

    if (useStorageUpload) {
      setUploading(true)
      try {
        const ext = getExtension(file.name)
        const path = `${authUserId}/${draftId}/${Date.now()}${ext}`
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || 'image/png', upsert: false })
        if (error) {
          setUploadError(error.message || 'Upload failed.')
          return
        }
        onPatternUploaded?.(path, URL.createObjectURL(file))
      } catch {
        setUploadError('Upload failed. Please try again.')
      } finally {
        setUploading(false)
      }
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      onImageSelect?.(dataUrl)
    }
    reader.onerror = () => setUploadError('Could not read the file.')
    reader.readAsDataURL(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    handleFile(file ?? null)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    handleFile(file ?? null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  // Flatten ALL placements + their extra angles into one unified gallery
  const allPhotos: Array<{ title: string; mockup_url: string }> = tabs
    ? tabs.flatMap((t) =>
        t.mockup_url
          ? [{ title: t.label, mockup_url: t.mockup_url }, ...(t.extra_mockups ?? [])]
          : []
      )
    : []
  const clampedIndex = Math.min(activeGalleryIndex, Math.max(0, allPhotos.length - 1))
  const selectedMockupUrl = allPhotos[clampedIndex]?.mockup_url ?? ''
  const referenceUrl = selectedMockupUrl || catalogFallbackUrl || ''

  const hasImage =
    activeLayers.length > 0 || Boolean(imageUrl?.trim()) || Boolean(hasPatternImage)
  const layerCount = activeLayers.length
  const hasMockups = Boolean(tabs?.some((t) => t.mockup_url?.trim()))

  const showShoeCanvas = useShoeCanvas && viewMode === 'canvas' && !mockupImagesLoading
  const showMockupsView = (viewMode === 'mockups' || !useShoeCanvas) && !mockupImagesLoading

  return (
    <div className="preview-workspace">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_IMAGES}
        onChange={handleInputChange}
        className="preview-canvas-file-input"
        aria-hidden
      />

      {/* No image: upload hero */}
      {!hasImage && !uploading && !showTextPanel && (
        <div
          className={`preview-upload-hero${isDragging ? ' preview-upload-hero--dragging' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Upload or drop your design here"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="preview-upload-hero-icon" aria-hidden>
            <Upload size={32} strokeWidth={1.5} />
          </div>
          <h3 className="preview-upload-hero-title">Add your design</h3>
          <p className="preview-upload-hero-hint">
            Upload an image to see it applied to the product template
          </p>
          <span className="preview-upload-hero-meta">
            JPG, PNG, WebP · max {MAX_SIZE_MB} MB
          </span>
        </div>
      )}

      {uploading && (
        <div className="preview-upload-hero">
          <div className="preview-loading-spinner" style={{ marginBottom: '0.75rem' }} aria-hidden />
          <p className="preview-loading-message">Uploading your design…</p>
        </div>
      )}

      {/* Has image: compact action bar */}
      {hasImage && viewMode === 'canvas' && (
        <div className="preview-image-bar">
          {(() => {
            const imgLayer = activeLayers.find((l): l is (typeof l & { signedUrl?: string | null }) => 'signedUrl' in l)
            const thumbSrc = imgLayer?.signedUrl ?? imageUrl
            return thumbSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbSrc} alt="" className="preview-image-bar-thumb" />
            ) : null
          })()}
          <span className="preview-image-bar-label">
            {layerCount > 1 ? `${layerCount} layers applied` : 'Pattern applied'}
          </span>
          <div className="preview-image-bar-actions">
            <button
              type="button"
              className="preview-image-bar-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={13} aria-hidden /> Add image
            </button>
            {onAddTextLayer && (
              <button
                type="button"
                className="preview-image-bar-btn"
                onClick={() => setShowTextPanel((v) => !v)}
              >
                T Add text
              </button>
            )}
            <button
              type="button"
              className="preview-image-bar-btn preview-image-bar-btn--remove"
              onClick={onImageClear}
              aria-label="Remove selected layer"
              disabled={layerCount === 0 && !hasPatternImage}
            >
              <X size={13} aria-hidden /> Remove
            </button>
          </div>
        </div>
      )}

      {/* Text layer add panel */}
      {showTextPanel && onAddTextLayer && viewMode === 'canvas' && (
        <div className="preview-text-panel">
          <input
            type="text"
            className="design-tool-input preview-text-panel-input"
            placeholder="Enter text…"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            aria-label="Text content"
          />
          <div className="preview-text-panel-row">
            <select
              className="design-tool-select preview-text-panel-font"
              value={textFont}
              onChange={(e) => setTextFont(e.target.value)}
              aria-label="Font"
              style={{ fontFamily: textFont }}
            >
              {FONTS.map((f) => (
                <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                  {f.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="design-tool-input preview-text-panel-size"
              value={textSize}
              min={20}
              max={600}
              onChange={(e) => setTextSize(Math.max(20, Number(e.target.value) || 120))}
              aria-label="Font size"
              title="Font size (printfile pixels)"
            />
            <input
              type="color"
              className="preview-text-panel-color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              aria-label="Text color"
            />
          </div>
          <div className="preview-text-panel-actions">
            <button
              type="button"
              className="design-tool-btn design-tool-btn-secondary"
              onClick={() => setShowTextPanel(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="design-tool-btn design-tool-btn-publish"
              disabled={!textInput.trim()}
              onClick={() => {
                if (!textInput.trim()) return
                onAddTextLayer({
                  id: crypto.randomUUID(),
                  type: 'text',
                  text: textInput.trim(),
                  fontFamily: textFont,
                  fontSize: textSize,
                  color: textColor,
                  dx: 0,
                  dy: 0,
                })
                setTextInput('')
                setShowTextPanel(false)
              }}
            >
              Add text
            </button>
          </div>
        </div>
      )}

      {/* Mockup generation spinner */}
      {mockupImagesLoading && (
        <div className="preview-reference-loading" role="status">
          <div className="preview-loading-spinner" aria-hidden />
          <span className="preview-loading-message">
            {LOADING_MESSAGES[Math.min(loadingPhase, LOADING_MESSAGES.length - 1)]}
          </span>
          {loadingPhase >= 3 && (
            <span className="preview-loading-timeout-hint">
              Taking longer than expected — you can keep editing and check back soon.
            </span>
          )}
        </div>
      )}

      {/* CANVAS VIEW: full-height shoe template editor */}
      {showShoeCanvas && (
        <div className="preview-shoe-canvas-section">
          {/* Canvas header: placement tabs + Preview button */}
          <div className="preview-canvas-header">
            <div className="preview-canvas-header-tabs" role="tablist" aria-label="Print placement">
              {templateWithUrl.map((row) => {
                const sel = (externalActivePlacement ?? templateWithUrl[0]?.placement) === row.placement
                return (
                  <button
                    key={row.placement}
                    type="button"
                    role="tab"
                    aria-selected={sel}
                    className={`shoe-design-tab${sel ? ' shoe-design-tab--active' : ''}`}
                    onClick={() => onActivePlacementChange?.(row.placement)}
                  >
                    {row.label}
                  </button>
                )
              })}
            </div>
            {onRefreshPrintfulPreview && (
              <button
                type="button"
                className="preview-canvas-header-preview-btn"
                onClick={() => void handlePreviewClick()}
                disabled={previewLoading || !hasPatternImage}
                title={!hasPatternImage ? 'Add a pattern first' : undefined}
              >
                {previewLoading ? 'Generating…' : hasMockups && !isDirty ? 'Preview →' : 'Preview →'}
              </button>
            )}
          </div>
          <ShoeDesignEditor
            templates={templateWithUrl}
            activePlacement={externalActivePlacement ?? templateWithUrl[0]?.placement ?? ''}
            onActivePlacementChange={onActivePlacementChange ?? (() => {})}
            layers={activeLayers}
            selectedLayerId={selectedLayerId}
            onLayerSelect={onLayerSelect}
            onLayerChange={onLayerChange ?? (() => {})}
            onLayerDelete={onLayerDelete}
            onLayerReorder={onLayerReorder}
            onLayerDuplicate={onLayerDuplicate}
            onPasteLayer={onPasteLayer}
            layerClipboardRef={layerClipboardRef}
          />
        </div>
      )}

      {/* MOCKUPS VIEW: full-height mockup image */}
      {showMockupsView && (referenceUrl || (tabs && tabs.length > 0)) && (
        <div className="preview-mockups-section">
          {/* Mockups header: back button only */}
          {useShoeCanvas && (
            <div className="preview-canvas-header">
              <button
                type="button"
                className="preview-canvas-header-back-btn"
                onClick={() => setViewMode('canvas')}
              >
                ← Edit template
              </button>
            </div>
          )}
          {catalogOnlyReference && (
            <p className="preview-reference-catalog-note" role="status" style={{ padding: '0 1rem' }}>
              Using catalog photos — Printful mockups are not available for this product.
            </p>
          )}
          {referenceUrl && (
            <div className="preview-mockup-fullview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={referenceUrl}
                alt={allPhotos[clampedIndex]?.title || selectedModelName || 'Mockup'}
                className="preview-mockup-fullview-img"
              />
            </div>
          )}
          {allPhotos.length > 1 && (
            <div className="preview-mockup-gallery" role="list" aria-label="All mockup views">
              {allPhotos.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  role="listitem"
                  className={`preview-mockup-gallery-thumb${i === clampedIndex ? ' preview-mockup-gallery-thumb--active' : ''}`}
                  onClick={() => setActiveGalleryIndex(i)}
                  title={item.title || `View ${i + 1}`}
                  aria-pressed={i === clampedIndex}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.mockup_url} alt={item.title || `View ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {uploadError && (
        <p className="preview-canvas-error" role="alert">
          {uploadError}
        </p>
      )}
    </div>
  )
}
