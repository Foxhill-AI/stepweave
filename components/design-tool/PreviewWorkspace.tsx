'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Palette, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import type { DesignToolMode } from './ModeTabs'
import ShoeDesignEditor from './ShoeDesignEditor'
import type { PlacementTemplateRow } from '@/lib/printful/placementTemplate'
import type { PrintfulPlacementsState, PlacementCompactTransform } from '@/lib/designDraftState'

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
  mode: DesignToolMode
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
  onPatternUploaded?: (path: string) => void
  imageUrl?: string | null
  onImageClear?: () => void
  /** Template rows from Printful for shoe canvas display. */
  templateRows?: PlacementTemplateRow[]
  templatesLoading?: boolean
  /** Current placement transforms from design_state */
  placementsState?: PrintfulPlacementsState
  /** Controlled active placement for shoe editor */
  activePlacement?: string
  onActivePlacementChange?: (placement: string) => void
  /** Called when user drags/scales in the shoe canvas */
  onPlacementsStateChange?: (
    nextOrUpdater: PrintfulPlacementsState | ((prev: PrintfulPlacementsState) => PrintfulPlacementsState)
  ) => void
}

function getExtension(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i >= 0 ? filename.slice(i) : '.png'
}

export default function PreviewWorkspace({
  mode,
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
  placementsState,
  activePlacement: externalActivePlacement,
  onActivePlacementChange,
  onPlacementsStateChange,
}: PreviewWorkspaceProps) {
  const tabs = placementMockups?.length ? placementMockups : null
  // Internal tab active placement (for mockup tabs), separate from shoe canvas placement
  const [activePlacement, setActivePlacement] = useState<string>('')
  // Index into the current placement's [main, ...extra_mockups] gallery (0 = main)
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  // 'canvas' = shoe template editor, 'mockups' = generated mockup images
  const [viewMode, setViewMode] = useState<'canvas' | 'mockups'>('canvas')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!tabs?.length) {
      setActivePlacement('')
      return
    }
    const keys = tabs.map((t) => t.placement)
    if (!keys.includes(activePlacement)) {
      setActivePlacement(keys[0])
    }
    setActiveGalleryIndex(0)
  }, [tabs, activePlacement])

  // Auto-switch to mockups view when real mockup URLs arrive after generation
  useEffect(() => {
    const hasRealMockups = placementMockups?.some((t) => t.mockup_url?.trim())
    if (hasRealMockups && !mockupImagesLoading) {
      setViewMode('mockups')
    }
  }, [placementMockups, mockupImagesLoading])

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
  const activeShoeTemplate = templateWithUrl.find(r => r.placement === externalActivePlacement) ?? templateWithUrl[0]
  const activeTransform: PlacementCompactTransform = (placementsState && externalActivePlacement && placementsState[externalActivePlacement])
    ? placementsState[externalActivePlacement]
    : { s: 1, dx: 0, dy: 0 }

  const handleShoeChange = useCallback(
    (patch: Partial<PlacementCompactTransform>) => {
      if (!onPlacementsStateChange || !externalActivePlacement) return
      onPlacementsStateChange((prev) => ({
        ...prev,
        [externalActivePlacement]: {
          s: patch.s ?? (prev[externalActivePlacement]?.s ?? 1),
          dx: patch.dx ?? (prev[externalActivePlacement]?.dx ?? 0),
          dy: patch.dy ?? (prev[externalActivePlacement]?.dy ?? 0),
        },
      }))
    },
    [onPlacementsStateChange, externalActivePlacement]
  )

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
        onPatternUploaded?.(path)
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

  if (mode === 'ai') {
    return (
      <div className="preview-workspace preview-workspace--ai">
        <div className="preview-workspace-preview-area" aria-label="Preview">
          <div className="preview-workspace-preview-icon" aria-hidden>
            <Palette size={28} strokeWidth={1.5} />
          </div>
          <p className="preview-workspace-preview-hint">
            Your design will appear here. Describe your idea and tap Generate.
          </p>
        </div>
      </div>
    )
  }

  const activeTab = tabs?.find((t) => t.placement === activePlacement)
  const activeLabel = activeTab?.label ?? 'Product'

  const galleryItems: Array<{ title: string; mockup_url: string }> = activeTab?.mockup_url
    ? [
        { title: activeLabel, mockup_url: activeTab.mockup_url },
        ...(activeTab.extra_mockups ?? []),
      ]
    : []
  const clampedIndex = Math.min(activeGalleryIndex, Math.max(0, galleryItems.length - 1))
  const selectedMockupUrl = galleryItems[clampedIndex]?.mockup_url ?? ''
  const referenceUrl = selectedMockupUrl || catalogFallbackUrl || ''

  const hasImage = Boolean(imageUrl?.trim())
  const hasMockups = Boolean(tabs?.some((t) => t.mockup_url?.trim())) || Boolean(catalogFallbackUrl?.trim())
  const showToggle = useShoeCanvas && hasMockups

  return (
    <div className="preview-workspace preview-workspace--manual">
      {/* Hidden file input — always rendered */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_IMAGES}
        onChange={handleInputChange}
        className="preview-canvas-file-input"
        aria-hidden
      />

      {/* STEP 1: No image — full upload hero */}
      {!hasImage && !uploading && (
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

      {/* Uploading state */}
      {uploading && (
        <div className="preview-upload-hero">
          <div className="preview-loading-spinner" style={{ marginBottom: '0.75rem' }} aria-hidden />
          <p className="preview-loading-message">Uploading your design…</p>
        </div>
      )}

      {/* STEP 2+: Has image — compact bar */}
      {hasImage && (
        <div className="preview-image-bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl!} alt="" className="preview-image-bar-thumb" />
          <span className="preview-image-bar-label">Pattern applied</span>
          <div className="preview-image-bar-actions">
            <button
              type="button"
              className="preview-image-bar-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={13} aria-hidden /> Change
            </button>
            <button
              type="button"
              className="preview-image-bar-btn preview-image-bar-btn--remove"
              onClick={onImageClear}
              aria-label="Remove image"
            >
              <X size={13} aria-hidden /> Remove
            </button>
          </div>
        </div>
      )}

      {/* Model label */}
      {selectedModelName && hasImage && (
        <p className="preview-workspace-model-label" aria-live="polite">
          <strong>{selectedModelName}</strong>
          {activeLabel && activeLabel !== 'Product' ? ` · ${activeLabel}` : ''}
        </p>
      )}

      {/* View toggle: Template ↔ Preview */}
      {showToggle && hasImage && (
        <div className="preview-view-toggle" role="tablist" aria-label="View mode">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'canvas'}
            className={`preview-view-toggle-btn${viewMode === 'canvas' ? ' preview-view-toggle-btn--active' : ''}`}
            onClick={() => setViewMode('canvas')}
          >
            Template
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'mockups'}
            className={`preview-view-toggle-btn${viewMode === 'mockups' ? ' preview-view-toggle-btn--active' : ''}`}
            onClick={() => setViewMode('mockups')}
          >
            Preview
          </button>
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
              Taking longer than expected — you can keep editing and refresh later.
            </span>
          )}
        </div>
      )}

      {/* CANVAS VIEW: ShoeDesignEditor */}
      {hasImage && useShoeCanvas && (viewMode === 'canvas' || !hasMockups) && !mockupImagesLoading && (
        <div className="preview-shoe-canvas-section">
          <ShoeDesignEditor
            templates={templateWithUrl}
            activePlacement={externalActivePlacement ?? activeShoeTemplate?.placement ?? ''}
            onActivePlacementChange={onActivePlacementChange ?? (() => {})}
            transform={activeTransform}
            patternImageUrl={imageUrl}
            onPlacementChange={handleShoeChange}
          />
        </div>
      )}

      {/* MOCKUPS VIEW: placement tabs + reference image + gallery */}
      {(viewMode === 'mockups' || !useShoeCanvas) && !mockupImagesLoading && (referenceUrl || (tabs && tabs.length > 0)) && (
        <>
          {tabs && tabs.length > 0 && (
            <div className="preview-view-tabs" role="tablist" aria-label="Print placements">
              {tabs.map((t) => (
                <button
                  key={t.placement}
                  type="button"
                  role="tab"
                  aria-selected={activePlacement === t.placement}
                  className={`preview-view-tab ${activePlacement === t.placement ? 'preview-view-tab--active' : ''}`}
                  onClick={() => setActivePlacement(t.placement)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {referenceUrl && (
            <div
              className="preview-reference-section"
              aria-label={`Product mockup: ${activeLabel}`}
            >
              <span className="preview-reference-label">Product mockup</span>
              {catalogOnlyReference && (
                <p className="preview-reference-catalog-note" role="status">
                  Using catalog photos — Printful mockups are not available for this product.
                </p>
              )}
              <div className="preview-reference-box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={referenceUrl}
                  alt={selectedModelName ? `${selectedModelName} – ${activeLabel}` : activeLabel}
                  className="preview-reference-img"
                />
              </div>
              {galleryItems.length > 1 && (
                <div className="preview-mockup-gallery" role="list" aria-label="All mockup views">
                  {galleryItems.map((item, i) => (
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
        </>
      )}

      {uploadError && (
        <p className="preview-canvas-error" role="alert">
          {uploadError}
        </p>
      )}
    </div>
  )
}
