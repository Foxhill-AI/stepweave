'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Paperclip, X } from 'lucide-react'

export type AiGeneratedVariant = {
  id: string
  storagePath: string
  previewUrl: string
  seed: number
}

type GenerationTurn = {
  id: string
  prompt: string
  styleSummary: string | null
  variants: AiGeneratedVariant[]
  /** true when this turn used a reference image */
  usedReference: boolean
}

type PhotoMode = null | 'direct' | 'ai-reference'

interface AIPromptPanelProps {
  /** Required for generation (draft from /design-tool/[id]). */
  draftId?: number
  /** Called when user confirms an AI variant; should persist `pattern_image_url` on the draft. */
  onPatternApplied?: (storagePath: string) => Promise<void>
  /** Called when user wants to use the attached photo directly on their shoes. */
  onUseDirectly?: (storagePath: string) => Promise<void>
  /** Called to advance to the customize step. */
  onNext?: () => void
}

const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp,image/gif'
const MAX_SIZE_MB = 10
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

export default function AIPromptPanel({ draftId, onPatternApplied, onUseDirectly, onNext }: AIPromptPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<GenerationTurn[]>([])
  const [selectedVariant, setSelectedVariant] = useState<AiGeneratedVariant | null>(null)
  const [photoMode, setPhotoMode] = useState<PhotoMode>(null)
  const [nextLoading, setNextLoading] = useState(false)

  // Reference image state
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(null)
  const [referenceStoragePath, setReferenceStoragePath] = useState<string | null>(null)
  const [referenceUploading, setReferenceUploading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Track blob URL so we can revoke it when replaced
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  const handleFileSelect = useCallback(
    async (file: File | null) => {
      if (!file) return
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file (JPG, PNG, WebP).')
        return
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(`Image must be under ${MAX_SIZE_MB} MB.`)
        return
      }

      // Revoke previous blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }

      // Show preview immediately, reset any previous mode choice
      const previewUrl = URL.createObjectURL(file)
      blobUrlRef.current = previewUrl
      setReferencePreviewUrl(previewUrl)
      setReferenceStoragePath(null)
      setPhotoMode(null)
      setError(null)

      if (!draftId) return // can't upload without a draft

      setReferenceUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch(`/api/design-drafts/${draftId}/reference-image`, {
          method: 'POST',
          body: formData,
        })
        const body = (await res.json().catch(() => ({}))) as { storagePath?: string; error?: string }
        if (!res.ok) {
          setError(body.error || 'Image upload failed.')
          setReferencePreviewUrl(null)
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current)
            blobUrlRef.current = null
          }
          return
        }
        setReferenceStoragePath(body.storagePath ?? null)
      } catch {
        setError('Image upload failed. Please try again.')
        setReferencePreviewUrl(null)
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current)
          blobUrlRef.current = null
        }
      } finally {
        setReferenceUploading(false)
      }
    },
    [draftId]
  )

  const handleRemoveReference = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setReferencePreviewUrl(null)
    setReferenceStoragePath(null)
    setPhotoMode(null)
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!draftId) {
      setError('Create a design draft first (continue from the model picker).')
      return
    }
    const trimmed = prompt.trim()
    if (!trimmed) {
      setError('Enter a description of your design.')
      return
    }
    if (referencePreviewUrl && !referenceStoragePath && !referenceUploading) {
      setError('Reference image failed to upload. Remove it and try again.')
      return
    }
    if (referenceUploading) {
      setError('Please wait for the reference image to finish uploading.')
      return
    }

    setLoading(true)
    setError(null)

    const isI2I = Boolean(referenceStoragePath) && photoMode === 'ai-reference'
    try {
      const res = await fetch(`/api/design-drafts/${draftId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: isI2I ? 'image-to-image' : 'text-to-image',
          prompt: trimmed,
          variationCount: 3,
          ...(isI2I ? { referenceImagePath: referenceStoragePath } : {}),
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        variants?: AiGeneratedVariant[]
        style_summary?: string
      }
      if (!res.ok) {
        setError(body.error || 'Generation failed.')
        return
      }
      if (!body.variants?.length) {
        setError('No images were returned. Try again.')
        return
      }
      setHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          prompt: trimmed,
          styleSummary: body.style_summary ?? null,
          variants: body.variants!,
          usedReference: isI2I,
        },
      ])
      setPrompt('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [draftId, prompt, referenceStoragePath, referencePreviewUrl, referenceUploading, photoMode])

  const handleNext = useCallback(async () => {
    setNextLoading(true)
    setError(null)
    try {
      if (photoMode === 'direct' && referenceStoragePath && onUseDirectly) {
        await onUseDirectly(referenceStoragePath)
      } else if (selectedVariant && onPatternApplied) {
        await onPatternApplied(selectedVariant.storagePath)
      }
      onNext?.()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setNextLoading(false)
    }
  }, [photoMode, referenceStoragePath, selectedVariant, onPatternApplied, onUseDirectly, onNext])

  const noDraft = !draftId

  // Next is available when: direct mode with uploaded photo, or AI variant selected
  const canGoNext =
    (photoMode === 'direct' && Boolean(referenceStoragePath) && !referenceUploading) ||
    (selectedVariant !== null && photoMode !== 'direct')

  return (
    <div className="ai-prompt-panel">
      {noDraft && (
        <p className="ai-prompt-draft-hint" role="status">
          Sign in and continue from the model picker to open a draft. Then you can generate
          images here.
        </p>
      )}

      {/* ── Conversation history ── */}
      <div className="ai-prompt-messages" aria-label="AI design conversation" aria-live="polite">
        {history.length === 0 && !loading && (
          <div className="ai-prompt-message placeholder">
            Describe your design — or attach a photo to place directly on your shoes or use as style inspiration.
          </div>
        )}

        {history.map((turn) => (
          <div key={turn.id} className="ai-prompt-turn">
            <div className="ai-prompt-message user">
              {turn.usedReference && (
                <span className="ai-prompt-turn-ref-badge" aria-label="Used reference image">
                  <Paperclip size={11} aria-hidden /> ref
                </span>
              )}
              {turn.prompt}
            </div>

            <div className="ai-prompt-turn-response">
              {turn.styleSummary && (
                <div className="ai-prompt-message assistant">
                  <strong>Style:</strong> {turn.styleSummary}
                </div>
              )}
              <div className="ai-prompt-variants-grid">
                {turn.variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={`ai-prompt-variant-card${isSelected ? ' ai-prompt-variant-card--selected' : ''}`}
                      onClick={() => setSelectedVariant(v)}
                      aria-label={isSelected ? 'Selected pattern' : 'Select this pattern'}
                      aria-pressed={isSelected}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.previewUrl} alt="" className="ai-prompt-variant-img" />
                      <span className="ai-prompt-variant-cta">
                        {isSelected ? 'Selected ✓' : 'Select'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="ai-prompt-generating" role="status" aria-label="Generating patterns">
            <span className="ai-prompt-generating-dots" aria-hidden>
              <span /><span /><span />
            </span>
            Generating patterns…
          </div>
        )}

        <div ref={messagesEndRef} aria-hidden />
      </div>

      {/* ── Selected pattern preview (no apply button — Next handles it) ── */}
      {selectedVariant && photoMode !== 'direct' && (
        <div className="ai-prompt-selected-panel">
          <p className="ai-prompt-selected-label">Selected pattern</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedVariant.previewUrl}
            alt="Selected pattern preview"
            className="ai-prompt-selected-img"
          />
        </div>
      )}

      {/* ── Input area ── */}
      <div className="ai-prompt-input-wrap">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_IMAGES}
          className="sr-only"
          aria-hidden
          onChange={(e) => {
            void handleFileSelect(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />

        {/* Photo attachment row */}
        {referencePreviewUrl ? (
          <div className="ai-prompt-reference-row">
            <div className="ai-prompt-reference-thumb-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={referencePreviewUrl}
                alt="Attached photo"
                className="ai-prompt-reference-thumb"
              />
              {referenceUploading && (
                <div className="ai-prompt-reference-uploading" aria-label="Uploading…">
                  <span className="ai-prompt-reference-spinner" aria-hidden />
                </div>
              )}
            </div>

            <div className="ai-prompt-reference-meta">
              {!photoMode ? (
                /* Choice buttons — shown immediately after upload finishes */
                <div className="ai-prompt-photo-choice">
                  <p className="ai-prompt-photo-choice-label">
                    {referenceUploading ? 'Uploading…' : 'What would you like to do?'}
                  </p>
                  {!referenceUploading && (
                    <div className="ai-prompt-photo-choice-btns">
                      <button
                        type="button"
                        className="ai-prompt-photo-choice-btn"
                        onClick={() => setPhotoMode('direct')}
                      >
                        Put it on my shoes
                      </button>
                      <button
                        type="button"
                        className="ai-prompt-photo-choice-btn"
                        onClick={() => setPhotoMode('ai-reference')}
                      >
                        Use as AI inspiration
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Mode confirmed */
                <>
                  <span className="ai-prompt-reference-label">
                    {photoMode === 'direct'
                      ? 'Will be placed on your shoes'
                      : 'AI style reference ready'}
                  </span>
                  <button
                    type="button"
                    className="ai-prompt-reference-change"
                    onClick={() => setPhotoMode(null)}
                  >
                    Change
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              className="ai-prompt-reference-remove"
              onClick={handleRemoveReference}
              aria-label="Remove photo"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ) : (
          <div className="ai-prompt-attach-row">
            <button
              type="button"
              className="ai-prompt-attach-btn"
              aria-label="Attach a photo"
              onClick={() => fileInputRef.current?.click()}
              disabled={!draftId}
              title={!draftId ? 'Open a draft to attach photos' : 'Attach a photo'}
            >
              <Paperclip size={18} aria-hidden />
              Attach photo
            </button>
            <span className="ai-prompt-attach-hint">Place on shoe or use as AI reference</span>
          </div>
        )}

        {/* Text prompt + generate — hidden when photo is set to direct mode */}
        {photoMode !== 'direct' && (
          <>
            <label htmlFor="ai-prompt-input" className="sr-only">
              Design prompt
            </label>
            <textarea
              id="ai-prompt-input"
              className="ai-prompt-input"
              placeholder={
                history.length > 0
                  ? 'Refine, iterate, or try a new direction…'
                  : 'Describe what you want to create…'
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void handleGenerate()
                }
              }}
              rows={2}
              aria-label="Design prompt"
              disabled={loading}
            />
            {error && (
              <p className="ai-prompt-error" role="alert">
                {error}
              </p>
            )}
            <div className="ai-prompt-actions">
              <button
                type="button"
                className="ai-prompt-btn primary"
                onClick={() => void handleGenerate()}
                disabled={loading || noDraft || !prompt.trim() || referenceUploading}
              >
                {loading ? 'Generating…' : 'Generate'}
              </button>
              {history.length > 0 && (
                <button
                  type="button"
                  className="ai-prompt-btn secondary"
                  onClick={() => { setHistory([]); setSelectedVariant(null); setError(null) }}
                  disabled={loading}
                >
                  Clear history
                </button>
              )}
            </div>
            {history.length > 0 && (
              <p className="ai-prompt-shortcut-hint">Tip: ⌘ Enter to generate</p>
            )}
          </>
        )}

        {/* Error in direct mode */}
        {photoMode === 'direct' && error && (
          <p className="ai-prompt-error" role="alert">{error}</p>
        )}

        {/* Continue button — appears when ready to advance */}
        {canGoNext && onNext && (
          <button
            type="button"
            className="ai-prompt-btn primary ai-prompt-next-btn"
            onClick={() => void handleNext()}
            disabled={nextLoading}
          >
            {nextLoading ? 'Saving…' : 'Continue to customize →'}
          </button>
        )}
      </div>
    </div>
  )
}
