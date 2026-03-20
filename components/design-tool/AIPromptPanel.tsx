'use client'

import { useState, useCallback } from 'react'
import { Paperclip } from 'lucide-react'

export type AiGeneratedVariant = {
  id: string
  storagePath: string
  previewUrl: string
  seed: number
}

interface AIPromptPanelProps {
  /** Required for generation (draft from /design-tool/[id]). */
  draftId?: number
  /** Called when user picks a variant; should persist `pattern_image_url` on the draft. */
  onPatternApplied?: (storagePath: string) => Promise<void>
}

export default function AIPromptPanel({
  draftId,
  onPatternApplied,
}: AIPromptPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [variants, setVariants] = useState<AiGeneratedVariant[]>([])
  const [styleSummary, setStyleSummary] = useState<string | null>(null)
  const [selectingId, setSelectingId] = useState<string | null>(null)

  const handleClear = () => {
    setPrompt('')
    setError(null)
    setVariants([])
    setStyleSummary(null)
  }

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
    setLoading(true)
    setError(null)
    setVariants([])
    setStyleSummary(null)
    try {
      const res = await fetch(`/api/design-drafts/${draftId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'text-to-image',
          prompt: trimmed,
          variationCount: 3,
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
      setVariants(body.variants)
      setStyleSummary(body.style_summary ?? null)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [draftId, prompt])

  const handleSelectVariant = useCallback(
    async (v: AiGeneratedVariant) => {
      if (!onPatternApplied) return
      setSelectingId(v.id)
      setError(null)
      try {
        await onPatternApplied(v.storagePath)
      } catch {
        setError('Could not save selection. Try again.')
      } finally {
        setSelectingId(null)
      }
    },
    [onPatternApplied]
  )

  const noDraft = !draftId

  return (
    <div className="ai-prompt-panel">
      {noDraft && (
        <p className="ai-prompt-draft-hint" role="status">
          Sign in and continue from the model picker to open a draft. Then you can generate
          images here.
        </p>
      )}

      <div className="ai-prompt-messages" aria-label="AI design">
        <div className="ai-prompt-message placeholder">
          Describe your pattern or graphic. We&apos;ll expand it with GPT, run a safety check,
          then generate variants with Fal (Fast SDXL).
        </div>
        {styleSummary && (
          <div className="ai-prompt-message assistant" role="status">
            <strong>Style:</strong> {styleSummary}
          </div>
        )}
      </div>

      <div className="ai-prompt-input-wrap">
        <div className="ai-prompt-attach-row">
          <button
            type="button"
            className="ai-prompt-attach-btn"
            aria-label="Attach file (coming soon)"
            disabled
          >
            <Paperclip size={18} aria-hidden />
            Attach
          </button>
          <span className="ai-prompt-attach-hint">Image reference (Path B) — soon</span>
        </div>
        <label htmlFor="ai-prompt-input" className="sr-only">
          Design prompt
        </label>
        <textarea
          id="ai-prompt-input"
          className="ai-prompt-input"
          placeholder="Describe what you want to create…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
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
            disabled={loading || noDraft || !prompt.trim()}
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
          <button
            type="button"
            className="ai-prompt-btn secondary"
            onClick={handleClear}
            disabled={loading}
          >
            Clear
          </button>
        </div>
      </div>

      {variants.length > 0 && (
        <div className="ai-prompt-variants" aria-label="Generated variants">
          <p className="ai-prompt-variants-title">Pick one for your pattern</p>
          <div className="ai-prompt-variants-grid">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                className="ai-prompt-variant-card"
                onClick={() => void handleSelectVariant(v)}
                disabled={selectingId !== null}
              >
                <img
                  src={v.previewUrl}
                  alt={`Variant ${v.id}`}
                  className="ai-prompt-variant-img"
                />
                <span className="ai-prompt-variant-cta">
                  {selectingId === v.id ? 'Saving…' : 'Use this'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
