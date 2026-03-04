'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'

interface MediaUploaderUIProps {
  className?: string
}

export default function MediaUploaderUI({ className = '' }: MediaUploaderUIProps) {
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    // UI only – no actual upload
  }

  const handleClick = () => {
    // UI only – no file picker opened
  }

  return (
    <div
      className={`media-uploader ${dragOver ? 'drag-over' : ''} ${className}`.trim()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      aria-label="Upload or drop files (UI only)"
    >
      <Upload size={28} className="media-uploader-icon" aria-hidden />
      <p className="media-uploader-text">Drag and drop files here, or click to browse</p>
      <button type="button" className="media-uploader-btn" onClick={(e) => e.stopPropagation()}>
        Upload
      </button>
    </div>
  )
}
