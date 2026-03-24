'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Palette, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import type { DesignToolMode } from './ModeTabs'

const ACCEPT_IMAGES = 'image/*'
const MAX_SIZE_MB = 10
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
const BUCKET = 'design-patterns'

/** One placement from Printful mockups (dynamic tabs). */
export type PlacementTab = {
  placement: string
  label: string
  mockup_url: string
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
}: PreviewWorkspaceProps) {
  const tabs = placementMockups?.length ? placementMockups : null
  const [activePlacement, setActivePlacement] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
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
  }, [tabs, activePlacement])

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

  const handleDropzoneClick = () => {
    if (imageUrl) return
    fileInputRef.current?.click()
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
  const referenceUrl = activeTab?.mockup_url || catalogFallbackUrl || ''
  const activeLabel = activeTab?.label ?? 'Product'

  return (
    <div className="preview-workspace preview-workspace--manual">
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
      {selectedModelName && (
        <p className="preview-workspace-model-label" aria-live="polite">
          Showing: <strong>{selectedModelName}</strong>
          {tabs?.length ? ` – ${activeLabel}` : ' – reference'}
        </p>
      )}
      {(referenceUrl || mockupImagesLoading) && (
        <div
          className="preview-reference-section"
          aria-label={`Product reference: ${activeLabel}`}
        >
          <span className="preview-reference-label">Product reference</span>
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
          {!mockupImagesLoading && catalogOnlyReference && referenceUrl && (
            <p className="preview-reference-catalog-note" role="status">
              Using catalog photos — Printful mockups are not available for this product in the API.
            </p>
          )}
          {referenceUrl && (
            <div className="preview-reference-box">
              <img
                src={referenceUrl}
                alt={selectedModelName ? `${selectedModelName} – ${activeLabel}` : activeLabel}
                className="preview-reference-img"
              />
            </div>
          )}
        </div>
      )}
      <div className="preview-canvas">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_IMAGES}
          onChange={handleInputChange}
          className="preview-canvas-file-input"
          aria-hidden
        />
        <div className="preview-canvas-layers">
          {imageUrl || uploading ? (
            <div className="preview-canvas-preview">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Your design"
                  className="preview-canvas-preview-img"
                />
              )}
              {uploading && (
                <p className="preview-canvas-uploading" role="status">
                  Uploading…
                </p>
              )}
              <div className="preview-canvas-preview-actions">
                <button
                  type="button"
                  className="preview-canvas-preview-btn preview-canvas-preview-btn-change"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={16} aria-hidden />
                  {uploading ? 'Uploading…' : 'Change image'}
                </button>
                <button
                  type="button"
                  className="preview-canvas-preview-btn preview-canvas-preview-btn-remove"
                  onClick={onImageClear}
                  aria-label="Remove image"
                >
                  <X size={16} aria-hidden />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`preview-canvas-dropzone ${isDragging ? 'preview-canvas-dropzone--dragging' : ''}`}
              role="button"
              tabIndex={0}
              aria-label="Upload or drop your design here"
              onClick={handleDropzoneClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleDropzoneClick()
                }
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload size={28} className="preview-canvas-dropzone-icon" aria-hidden />
              <span>Upload or drop your design here</span>
              <span className="preview-canvas-dropzone-hint">
                Images only (JPG, PNG, WebP), max {MAX_SIZE_MB} MB
              </span>
            </div>
          )}
        </div>
        {uploadError && (
          <p className="preview-canvas-error" role="alert">
            {uploadError}
          </p>
        )}
      </div>
    </div>
  )
}
