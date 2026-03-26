'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Paperclip } from 'lucide-react'

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
}

interface AIPromptPanelProps {
  /** Required for generation (draft from /design-tool/[id]). */
  draftId?: number
  /** Called when user picks a variant; should persist `pattern_image_url` on the draft. */
  onPatternApplied?: (storagePath: string) => Promise<void>
}

export default function AIPromptPanel({ draftId, onPatternApplied }: AIPromptPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<GenerationTurn[]>([])
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to the bottom whenever a new turn is added or generation starts
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

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
    try {
      const res = await fetch(`/api/design-drafts/${draftId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'text-to-image', prompt: trimmed, variationCount: 3 }),
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
        },
      ])
      setPrompt('')
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
        // Parent switches mode away on success — no need to reset selectingId
      } catch {
        setError('Could not save selection. Try again.')
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

      {/* ── Conversation history ── */}
      <div className="ai-prompt-messages" aria-label="AI design conversation" aria-live="polite">
        {history.length === 0 && !loading && (
          <div className="ai-prompt-message placeholder">
            Describe your pattern or graphic. We&apos;ll expand it with GPT, run a safety
            check, then generate variants with Fal (Fast SDXL).
          </div>
        )}

        {history.map((turn) => (
          <div key={turn.id} className="ai-prompt-turn">
            {/* User prompt bubble */}
            <div className="ai-prompt-message user">{turn.prompt}</div>

            {/* AI response: style summary + variants */}
            <div className="ai-prompt-turn-response">
              {turn.styleSummary && (
                <div className="ai-prompt-message assistant">
                  <strong>Style:</strong> {turn.styleSummary}
                </div>
              )}
              <div className="ai-prompt-variants-grid">
                {turn.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`ai-prompt-variant-card${selectingId === v.id ? ' ai-prompt-variant-card--selecting' : ''}`}
                    onClick={() => void handleSelectVariant(v)}
                    disabled={selectingId !== null}
                    aria-label="Use this pattern"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.previewUrl} alt="" className="ai-prompt-variant-img" />
                    <span className="ai-prompt-variant-cta">
                      {selectingId === v.id ? 'Applying…' : 'Use this'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Animated indicator shown inline while generating */}
        {loading && (
          <div className="ai-prompt-generating" role="status" aria-label="Generating patterns">
            <span className="ai-prompt-generating-dots" aria-hidden>
              <span /><span /><span />
            </span>
            Generating patterns…
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} aria-hidden />
      </div>

      {/* ── Input area ── */}
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
          <span className="ai-prompt-attach-hint">Image reference — soon</span>
        </div>
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
            disabled={loading || noDraft || !prompt.trim()}
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
          {history.length > 0 && (
            <button
              type="button"
              className="ai-prompt-btn secondary"
              onClick={() => { setHistory([]); setError(null) }}
              disabled={loading}
            >
              Clear history
            </button>
          )}
        </div>
        {history.length > 0 && (
          <p className="ai-prompt-shortcut-hint">Tip: ⌘ Enter to generate</p>
        )}
      </div>
    </div>
  )
}
