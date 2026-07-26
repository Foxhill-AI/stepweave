'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { createDesignDraft } from '@/lib/supabaseClient'
import { setAuthReturnTo } from '@/lib/authReturnTo'
import type { PrintfulShoeProduct } from '@/app/api/printful/products/route'
import '../../styles/DesignTool.css'

const PENDING_SELECTION_KEY = 'design-tool-pending-selection'

type PendingSelection = {
  modelId: string
  structuralColor: 'white' | 'black'
}

function readPendingSelection(): PendingSelection | null {
  try {
    const raw = sessionStorage.getItem(PENDING_SELECTION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { modelId?: string; structuralColor?: 'white' | 'black' }
    if (!parsed.modelId) return null
    const structuralColor =
      parsed.structuralColor === 'black' || parsed.structuralColor === 'white'
        ? parsed.structuralColor
        : 'white'
    return { modelId: parsed.modelId, structuralColor }
  } catch {
    return null
  }
}

function clearPendingSelection() {
  try {
    sessionStorage.removeItem(PENDING_SELECTION_KEY)
  } catch {
    // ignore
  }
}

export default function BaseModelSelection() {
  const router = useRouter()
  const { userAccount, loading: authLoading } = useAuth()
  const [products, setProducts] = useState<PrintfulShoeProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [structuralColor, setStructuralColor] = useState<'white' | 'black'>('white')
  const [continueLoading, setContinueLoading] = useState(false)
  const resumeStarted = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/printful/products')
      .then((res) => res.json())
      .then((data: { products?: PrintfulShoeProduct[]; error?: string }) => {
        if (cancelled) return
        if (data.error) {
          setError(data.error || 'Failed to load shoe models')
          setProducts([])
        } else {
          setProducts(data.products ?? [])
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load shoe models')
          setProducts([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Restore pending shoe choice after login (UI selection).
  useEffect(() => {
    if (loading || products.length === 0) return
    const pending = readPendingSelection()
    if (!pending) return
    if (products.some((p) => p.id === pending.modelId)) {
      setSelectedModelId(pending.modelId)
      setStructuralColor(pending.structuralColor)
    }
  }, [loading, products])

  const createDraftAndGo = useCallback(
    async (modelId: string, color: 'white' | 'black', accountId: number) => {
      setContinueLoading(true)
      setError(null)
      try {
        let designState: Record<string, unknown> = {}
        try {
          const pr = await fetch(`/api/printful/products/${encodeURIComponent(modelId)}`)
          if (pr.ok) {
            const body = (await pr.json()) as {
              variants?: Array<{ id: number; color?: string }>
            }
            const vars = body.variants ?? []
            const want = color === 'white' ? 'white' : 'black'
            const match = vars.find((v) => (v.color ?? '').toLowerCase() === want)
            const vid = match?.id ?? vars[0]?.id
            if (vid != null) designState = { printful_variant_id: vid }
          }
        } catch {
          // continue without variant id; mockup API will use first variant
        }

        const result = await createDesignDraft(accountId, {
          base_model_id: modelId,
          base_model_provider: 'printful',
          structural_color: color,
          pattern_source_type: 'ai_generated',
          design_state: designState,
        })
        if (result?.id) {
          clearPendingSelection()
          router.push(`/design-tool/${result.id}`)
          return
        }
        setError('Could not create draft. Please try again.')
      } catch {
        setError('Something went wrong. Please try again.')
      } finally {
        setContinueLoading(false)
      }
    },
    [router]
  )

  // After login, automatically continue creating the draft from the pending selection.
  useEffect(() => {
    if (authLoading || loading || products.length === 0) return
    if (!userAccount?.id || resumeStarted.current) return
    const pending = readPendingSelection()
    if (!pending) return
    if (!products.some((p) => p.id === pending.modelId)) {
      clearPendingSelection()
      return
    }
    resumeStarted.current = true
    void createDraftAndGo(pending.modelId, pending.structuralColor, userAccount.id)
  }, [authLoading, loading, products, userAccount, createDraftAndGo])

  const handleContinue = async () => {
    if (!selectedModelId) return

    if (!userAccount?.id) {
      try {
        sessionStorage.setItem(
          PENDING_SELECTION_KEY,
          JSON.stringify({ modelId: selectedModelId, structuralColor })
        )
      } catch {
        // ignore storage errors
      }
      setAuthReturnTo('/design-tool/new')
      router.push('/design-tool/new?openAuth=1')
      return
    }

    await createDraftAndGo(selectedModelId, structuralColor, userAccount.id)
  }

  return (
    <div className="base-model-page">
      <div className="base-model-container">
        <div className="base-model-header">
          <h1 className="base-model-heading">Choose your shoe</h1>
          <p className="base-model-subheading">
            Pick a model to start designing. You&apos;ll customize the look in the next step.
          </p>
        </div>

        {loading && (
          <p className="design-tool-loading" aria-live="polite">
            Loading models…
          </p>
        )}

        {error && !loading && (
          <p className="design-tool-form-error" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && products.length > 0 && (
          <>
            <div className="base-model-grid" role="listbox" aria-label="Shoe models">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={selectedModelId === p.id}
                  className={`base-model-card${selectedModelId === p.id ? ' base-model-card--selected' : ''}`}
                  onClick={() => setSelectedModelId(p.id)}
                >
                  <span className="base-model-card-image-wrap">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image}
                        alt=""
                        width={160}
                        height={160}
                        className="base-model-card-image"
                      />
                    ) : (
                      <span className="base-model-card-placeholder">No image</span>
                    )}
                  </span>
                  <span className="base-model-card-name">{p.name}</span>
                  {p.brand && <span className="base-model-card-brand">{p.brand}</span>}
                  {selectedModelId === p.id && (
                    <span className="base-model-card-selected-badge" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="base-model-color-section">
              <p className="base-model-color-section-title">Structural color</p>
              <p className="base-model-color-hint">Laces, sole, and inside of the shoe</p>
              <div className="base-model-color-cards" role="radiogroup" aria-label="Structural color">
                {(['white', 'black'] as const).map((color) => (
                  <label
                    key={color}
                    className={`base-model-color-card${structuralColor === color ? ' base-model-color-card--selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="structural-color"
                      value={color}
                      checked={structuralColor === color}
                      onChange={() => setStructuralColor(color)}
                      className="sr-only"
                      aria-label={color === 'white' ? 'White' : 'Black'}
                    />
                    <span
                      className={`base-model-color-card-swatch base-model-color-card-swatch--${color}`}
                      aria-hidden="true"
                    />
                    <span className="base-model-color-card-name">
                      {color === 'white' ? 'White' : 'Black'}
                    </span>
                    {structuralColor === color && (
                      <span className="base-model-color-card-check" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="base-model-actions">
              <button
                type="button"
                className="design-tool-btn design-tool-btn-publish base-model-continue-btn"
                disabled={!selectedModelId || continueLoading}
                onClick={() => void handleContinue()}
              >
                {continueLoading ? 'Creating…' : 'Continue'}
              </button>
            </div>
          </>
        )}

        {!loading && !error && products.length === 0 && (
          <p className="design-tool-loading">No shoe models available.</p>
        )}
      </div>
    </div>
  )
}
