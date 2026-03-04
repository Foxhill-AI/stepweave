'use client'

import { useState, useRef } from 'react'
import { Upload, Palette, X } from 'lucide-react'
import type { DesignToolMode } from './ModeTabs'

const ACCEPT_IMAGES = 'image/*'
const MAX_SIZE_MB = 10
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

interface PreviewWorkspaceProps {
  mode: DesignToolMode
  /** Called when user selects/drops an image (data URL). Manual mode only. */
  onImageSelect?: (imageUrl: string) => void
  /** Current image URL for preview (e.g. from design_data). Manual mode only. */
  imageUrl?: string | null
  /** Called when user clears the image. Manual mode only. */
  onImageClear?: () => void
}

export default function PreviewWorkspace({
  mode,
  onImageSelect,
  imageUrl,
  onImageClear,
}: PreviewWorkspaceProps) {
  const [activeView, setActiveView] = useState<'Front' | 'Back' | 'Right side' | 'Left side'>('Front')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File | null) => {
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

  return (
    <div className="preview-workspace preview-workspace--manual">
      <div className="preview-view-tabs" role="tablist" aria-label="Product view">
        {(['Front', 'Back', 'Right side', 'Left side'] as const).map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={activeView === view}
            className={`preview-view-tab ${activeView === view ? 'preview-view-tab--active' : ''}`}
            onClick={() => setActiveView(view)}
          >
            {view}
          </button>
        ))}
      </div>
      <div className="preview-canvas">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_IMAGES}
          onChange={handleInputChange}
          className="preview-canvas-file-input"
          aria-hidden
        />
        {imageUrl ? (
          <div className="preview-canvas-preview">
            <img
              src={imageUrl}
              alt="Your design"
              className="preview-canvas-preview-img"
            />
            <div className="preview-canvas-preview-actions">
              <button
                type="button"
                className="preview-canvas-preview-btn preview-canvas-preview-btn-change"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} aria-hidden />
                Change image
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
            <span className="preview-canvas-dropzone-hint">Images only (JPG, PNG, WebP), max {MAX_SIZE_MB} MB</span>
          </div>
        )}
        {uploadError && (
          <p className="preview-canvas-error" role="alert">
            {uploadError}
          </p>
        )}
      </div>
    </div>
  )
}
