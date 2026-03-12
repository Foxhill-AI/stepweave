'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { createDesignDraft } from '@/lib/supabaseClient'
import type { PrintfulShoeProduct } from '@/app/api/printful/products/route'
import '../../styles/DesignTool.css'

export default function BaseModelSelection() {
  const router = useRouter()
  const { userAccount } = useAuth()
  const [products, setProducts] = useState<PrintfulShoeProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [structuralColor, setStructuralColor] = useState<'white' | 'black'>('white')
  const [continueLoading, setContinueLoading] = useState(false)

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
    return () => { cancelled = true }
  }, [])

  const handleContinue = async () => {
    if (!selectedModelId) return

    if (!userAccount?.id) {
      router.push('/?openAuth=1')
      return
    }

    setContinueLoading(true)
    setError(null)
    try {
      const result = await createDesignDraft(userAccount.id, {
        base_model_id: selectedModelId,
        base_model_provider: 'printful',
        structural_color: structuralColor,
        pattern_source_type: 'ai_generated',
      })
      if (result?.id) {
        router.push(`/design-tool/${result.id}`)
        return
      }
      setError('Could not create draft. Please try again.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setContinueLoading(false)
    }
  }

  return (
    <div className="design-tool-page">
      <div className="design-tool-layout base-model-selection-layout">
        <section
          className="design-tool-left"
          id="base-model-selection-panel"
          aria-labelledby="base-model-heading"
          role="region"
        >
          <h2 id="base-model-heading" className="design-tool-base-model-title">
            Choose your shoe model
          </h2>

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
                    className={`base-model-card ${selectedModelId === p.id ? 'base-model-card--selected' : ''}`}
                    onClick={() => setSelectedModelId(p.id)}
                  >
                    <span className="base-model-card-image-wrap">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image}
                          alt=""
                          width={120}
                          height={120}
                          className="base-model-card-image"
                        />
                      ) : (
                        <span className="base-model-card-placeholder">No image</span>
                      )}
                    </span>
                    <span className="base-model-card-name">{p.name}</span>
                    {p.brand && (
                      <span className="base-model-card-brand">{p.brand}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="base-model-color-section">
                <span className="design-tool-form-title">Structural color</span>
                <p className="base-model-color-hint">
                  Laces, sole, and inside of the shoe
                </p>
                <div className="base-model-color-options" role="radiogroup" aria-label="Structural color">
                  <label className="base-model-color-option">
                    <input
                      type="radio"
                      name="structural-color"
                      value="white"
                      checked={structuralColor === 'white'}
                      onChange={() => setStructuralColor('white')}
                      aria-label="White"
                    />
                    <span className="base-model-color-swatch base-model-color-swatch--white" aria-hidden />
                    <span>White</span>
                  </label>
                  <label className="base-model-color-option">
                    <input
                      type="radio"
                      name="structural-color"
                      value="black"
                      checked={structuralColor === 'black'}
                      onChange={() => setStructuralColor('black')}
                      aria-label="Black"
                    />
                    <span className="base-model-color-swatch base-model-color-swatch--black" aria-hidden />
                    <span>Black</span>
                  </label>
                </div>
              </div>

              <div className="design-tool-form-actions base-model-actions">
                <button
                  type="button"
                  className="design-tool-btn design-tool-btn-publish"
                  disabled={!selectedModelId || continueLoading}
                  onClick={handleContinue}
                >
                  {continueLoading ? 'Creating…' : 'Continue'}
                </button>
              </div>
            </>
          )}

          {!loading && !error && products.length === 0 && (
            <p className="design-tool-loading">No shoe models available.</p>
          )}
        </section>

        <section className="design-tool-right" aria-label="Preview" role="region">
          <div className="base-model-preview">
            {selectedModelId && products.find((p) => p.id === selectedModelId)?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={products.find((p) => p.id === selectedModelId)!.image}
                alt={products.find((p) => p.id === selectedModelId)!.name}
                width={320}
                height={320}
                className="base-model-preview-image"
              />
            ) : (
              <p className="base-model-preview-placeholder">
                Select a model to preview
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
