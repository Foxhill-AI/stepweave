'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Paperclip, X } from 'lucide-react'
import {
  appendDesignDraftAiMessages,
  deleteDesignDraftAiMessages,
  getDesignDraftAiMessages,
  type DesignDraftAiMessageRow,
} from '@/lib/supabaseClient'

const AI_MSG_V = 1
const KIND_USER = 'generation_user'
const KIND_ASSISTANT = 'generation_assistant'

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

function buildTurnsFromDbMessages(rows: DesignDraftAiMessageRow[]): GenerationTurn[] {
  const sorted = [...rows].sort((a, b) => a.message_index - b.message_index)
  const turns: GenerationTurn[] = []
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]
    if (row.role !== 'user') continue
    const uc = row.content
    if (uc.kind !== KIND_USER || typeof uc.prompt !== 'string') continue
    const next = sorted[i + 1]
    if (!next || next.role !== 'assistant') continue
    const ac = next.content
    if (ac.kind !== KIND_ASSISTANT || !Array.isArray(ac.variants)) continue
    const variantsRaw = ac.variants as unknown[]
    const variants: AiGeneratedVariant[] = []
    for (const item of variantsRaw) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      if (
        typeof o.id === 'string' &&
        typeof o.storagePath === 'string' &&
        typeof o.seed === 'number'
      ) {
        variants.push({
          id: o.id,
          storagePath: o.storagePath,
          previewUrl: '',
          seed: o.seed,
        })
      }
    }
    if (variants.length === 0) continue
    const styleSummary = typeof ac.styleSummary === 'string' ? ac.styleSummary : null
    turns.push({
      id: `db-${row.id}-${next.id}`,
      prompt: uc.prompt,
      styleSummary,
      variants,
      usedReference: Boolean(uc.usedReference),
    })
    i++
  }
  return turns
}

function collectStoragePaths(turns: GenerationTurn[]): string[] {
  const set = new Set<string>()
  for (const t of turns) {
    for (const v of t.variants) {
      if (v.storagePath?.trim()) set.add(v.storagePath.trim())
    }
  }
  return Array.from(set)
}

function applySignedUrls(turns: GenerationTurn[], urls: Record<string, string>): GenerationTurn[] {
  return turns.map((turn) => ({
    ...turn,
    variants: turn.variants.map((v) => ({
      ...v,
      previewUrl: urls[v.storagePath] ?? v.previewUrl,
    })),
  }))
}

interface AIPromptPanelProps {
  /** Required for generation (draft from /design-tool/[id]). */
  draftId?: number
  /** Called when user confirms an AI variant; adds image layers and persists `pattern_image_url`. */
  onPatternApplied?: (storagePath: string, previewUrl?: string) => Promise<void>
  /** Called when user wants to place their uploaded photo directly on the shoe. */
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
  const [applying, setApplying] = useState(false)
  /** Loading persisted rows from design_draft_ai_message */
  const [chatLoading, setChatLoading] = useState(false)
  /** null = no photo attached; 'direct' = place on shoe; 'ai-reference' = use as prompt inspiration */
  const [photoMode, setPhotoMode] = useState<null | 'direct' | 'ai-reference'>(null)

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

  useEffect(() => {
    if (!draftId) {
      setHistory([])
      setSelectedVariant(null)
      setChatLoading(false)
      return
    }
    let cancelled = false
    setChatLoading(true)
    ;(async () => {
      try {
        const rows = await getDesignDraftAiMessages(draftId)
        if (cancelled) return
        let turns = buildTurnsFromDbMessages(rows)
        const paths = collectStoragePaths(turns)
        if (paths.length > 0) {
          const res = await fetch(`/api/design-drafts/${draftId}/sign-storage-paths`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths }),
          })
          const body = (await res.json().catch(() => ({}))) as {
            urls?: Record<string, string>
          }
          if (res.ok && body.urls && typeof body.urls === 'object') {
            turns = applySignedUrls(turns, body.urls)
          }
        }
        if (cancelled) return
        setHistory(turns)
      } finally {
        if (!cancelled) setChatLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [draftId])

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

    const isI2I = Boolean(referenceStoragePath)
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
      const newTurn: GenerationTurn = {
        id: crypto.randomUUID(),
        prompt: trimmed,
        styleSummary: body.style_summary ?? null,
        variants: body.variants!,
        usedReference: isI2I,
      }
      setHistory((prev) => [...prev, newTurn])
      setPrompt('')
      const persistOk = await appendDesignDraftAiMessages(draftId, [
        {
          role: 'user',
          content: {
            v: AI_MSG_V,
            kind: KIND_USER,
            prompt: trimmed,
            usedReference: isI2I,
          },
        },
        {
          role: 'assistant',
          content: {
            v: AI_MSG_V,
            kind: KIND_ASSISTANT,
            styleSummary: body.style_summary ?? null,
            variants: body.variants!.map((v) => ({
              id: v.id,
              storagePath: v.storagePath,
              seed: v.seed,
            })),
          },
        },
      ])
      if (!persistOk) {
        console.warn('[AIPromptPanel] Failed to persist AI chat; history may reset on reload')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [draftId, prompt, referenceStoragePath, referencePreviewUrl, referenceUploading])

  const handleApplyToShoe = useCallback(async () => {
    if (!selectedVariant || !onPatternApplied) return
    setApplying(true)
    setError(null)
    try {
      await onPatternApplied(selectedVariant.storagePath, selectedVariant.previewUrl)
    } catch {
      setError('Could not apply pattern. Try again.')
    } finally {
      setApplying(false)
    }
  }, [selectedVariant, onPatternApplied])

  const handleNext = useCallback(async () => {
    setApplying(true)
    setError(null)
    try {
      if (photoMode === 'direct' && referenceStoragePath && onUseDirectly) {
        await onUseDirectly(referenceStoragePath)
      } else if (selectedVariant && onPatternApplied) {
        await onPatternApplied(selectedVariant.storagePath, selectedVariant.previewUrl)
      }
      onNext?.()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setApplying(false)
    }
  }, [photoMode, referenceStoragePath, selectedVariant, onPatternApplied, onUseDirectly, onNext])

  const canGoNext =
    (photoMode === 'direct' && Boolean(referenceStoragePath) && !referenceUploading) ||
    (selectedVariant !== null && photoMode !== 'direct')

  const noDraft = !draftId

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
        {chatLoading && (
          <div className="ai-prompt-message placeholder" role="status">
            Loading conversation…
          </div>
        )}
        {history.length === 0 && !loading && !chatLoading && (
          <div className="ai-prompt-message placeholder">
            Describe your pattern or graphic — or attach a reference image for style inspiration.
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

        {/* Reference image row */}
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
                /* Choice buttons — shown after upload finishes */
                <div className="ai-prompt-photo-choice">
                  <p className="ai-prompt-photo-choice-label">
                    {referenceUploading ? 'Uploading…' : 'What would you like to do with this photo?'}
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
                <>
                  <span className="ai-prompt-reference-label">
                    {photoMode === 'direct' ? 'Will be placed on your shoes' : 'AI style reference ready'}
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

        {/* Prompt textarea — hidden when user chose direct photo mode */}
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
          </>
        )}
        {error && (
          <p className="ai-prompt-error" role="alert">
            {error}
          </p>
        )}
        {photoMode !== 'direct' && (
        <div className="ai-prompt-actions">
          <button
            type="button"
            className="ai-prompt-btn primary"
            onClick={() => void handleGenerate()}
            disabled={loading || chatLoading || noDraft || !prompt.trim() || referenceUploading}
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
          {history.length > 0 && (
          <button
            type="button"
            className="ai-prompt-btn secondary"
            onClick={() => {
              void (async () => {
                if (draftId) {
                  const ok = await deleteDesignDraftAiMessages(draftId)
                  if (!ok) {
                    setError('Could not clear saved chat. Try again.')
                    return
                  }
                }
                setHistory([])
                setSelectedVariant(null)
                setError(null)
              })()
            }}
            disabled={loading || chatLoading}
          >
            Clear history
          </button>
          )}
        </div>
        )}
        {history.length > 0 && photoMode !== 'direct' && (
          <p className="ai-prompt-shortcut-hint">Tip: ⌘ Enter to generate</p>
        )}

        {/* Continue button — appears when ready to advance to customize step */}
        {canGoNext && onNext && (
          <button
            type="button"
            className="ai-prompt-btn primary ai-prompt-next-btn"
            onClick={() => void handleNext()}
            disabled={applying}
          >
            {applying ? 'Saving…' : 'Continue to customize →'}
          </button>
        )}
      </div>
    </div>
  )
}
