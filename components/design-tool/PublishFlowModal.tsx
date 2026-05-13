'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PricingEstimatePanel, { formatPricingMoney } from './PricingEstimatePanel'
import type { PricingEstimateOk } from '@/lib/printful/pricingEstimate'
import type { DesignDraftRow } from '@/lib/supabaseClient'
import { updateDesignDraft, updateProduct, setProductCategories, getProductById } from '@/lib/supabaseClient'

type FlowStep = 'buy' | 'publish' | 'both-skipped'

type CategoryRow = { id: number; name: string }
type VariantOption = { id: number; color: string; size: string; image: string }

interface PublishFlowModalProps {
  open: boolean
  onClose: () => void
  draftId: number
  localDraft: DesignDraftRow | null
  printfulVariantId: number | null
  variantOptions?: VariantOption[]
  categories: CategoryRow[]
  isEditingPublishedProduct: boolean
  designData: Record<string, unknown>
  /** When true, skip straight to the publish step (e.g. coming from post-purchase confirmation). */
  initialStep?: FlowStep
}

export default function PublishFlowModal({
  open,
  onClose,
  draftId,
  localDraft,
  printfulVariantId,
  variantOptions = [],
  categories,
  isEditingPublishedProduct,
  designData,
  initialStep,
}: PublishFlowModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<FlowStep>(initialStep ?? 'buy')

  // Buy step state — selectedBuyVariantId defaults to the draft's current variant (color auto-selected)
  const [selectedBuyVariantId, setSelectedBuyVariantId] = useState<number | null>(printfulVariantId)
  const [buyLoading, setBuyLoading] = useState(false)
  const [buyError, setBuyError] = useState<string | null>(null)
  const [buyEstimate, setBuyEstimate] = useState<PricingEstimateOk | null>(null)

  // Publish step state
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [publishEstimate, setPublishEstimate] = useState<PricingEstimateOk | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)

  // Pre-fill listing fields when editing an already-published product.
  useEffect(() => {
    const pid = localDraft?.final_product_id
    if (pid == null || typeof pid !== 'number') return
    let cancelled = false
    getProductById(pid).then((p) => {
      if (cancelled || !p) return
      const row = p as { name?: string; price?: number; product_category?: Array<{ category_id: number }> }
      if (typeof row.name === 'string' && row.name.trim()) setName(row.name)
      if (row.price != null && Number.isFinite(Number(row.price))) setPrice(String(row.price))
      const firstCat = row.product_category?.[0]?.category_id
      setCategoryId(firstCat != null && firstCat > 0 ? firstCat : '')
    })
    return () => { cancelled = true }
  }, [localDraft?.final_product_id])

  if (!open) return null

  const productId =
    localDraft?.base_model_id && typeof localDraft.base_model_id === 'string'
      ? localDraft.base_model_id.trim()
      : null

  // Derive size options: filter variantOptions to the same color as the draft's current variant.
  const currentVariant = variantOptions.find((v) => v.id === printfulVariantId)
  const draftColor = currentVariant?.color?.toLowerCase() ?? ''
  const sameColorVariants = draftColor
    ? variantOptions.filter((v) => v.color.toLowerCase() === draftColor)
    : variantOptions
  const hasSizeOptions = sameColorVariants.length > 1

  // The variant actually used for the pricing estimate and buy button.
  const effectiveBuyVariantId = selectedBuyVariantId ?? printfulVariantId
  const hasVariant = productId !== null && effectiveBuyVariantId != null

  const handleBuy = async () => {
    if (!effectiveBuyVariantId) {
      setBuyError('Please select a size.')
      return
    }
    setBuyLoading(true)
    setBuyError(null)
    try {
      const res = await fetch(`/api/design-drafts/${draftId}/self-purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: effectiveBuyVariantId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBuyError((data.error as string) || 'Could not initiate checkout. Please try again.')
        return
      }
      if (data.url) {
        window.location.href = data.url as string
      }
    } catch {
      setBuyError('Something went wrong. Please try again.')
    } finally {
      setBuyLoading(false)
    }
  }

  const handlePublish = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setCreateError('Please enter a product name.')
      return
    }
    const priceNum = parseFloat(price)
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setCreateError('Please enter a valid price.')
      return
    }
    if (publishEstimate && priceNum + 1e-9 < publishEstimate.minimumViablePrice) {
      setCreateError(
        `Price must be at least ${formatPricingMoney(publishEstimate.minimumViablePrice, publishEstimate.currency)}.`
      )
      return
    }
    setCreateError(null)
    setCreateLoading(true)
    try {
      const existingProductId = localDraft?.final_product_id
      if (typeof existingProductId === 'number' && existingProductId > 0) {
        const okDraft = await updateDesignDraft(draftId, { design_state: designData })
        if (!okDraft) { setCreateError('Failed to save design. Please try again.'); return }
        const okProduct = await updateProduct(existingProductId, {
          name: trimmedName,
          price: priceNum,
          design_data: { source: 'design_draft' },
        })
        if (!okProduct) { setCreateError('Failed to update product. Please try again.'); return }
        await setProductCategories(existingProductId, categoryId !== '' ? [categoryId as number] : [])
        router.push('/profile')
        return
      }

      const res = await fetch(`/api/design-drafts/${draftId}/create-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          price: priceNum,
          categoryId: categoryId !== '' ? (categoryId as number) : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.productId) {
        router.push('/profile')
      } else {
        setCreateError((data.error as string) || 'Failed to publish. Please try again.')
      }
    } catch {
      setCreateError('Something went wrong. Please try again.')
    } finally {
      setCreateLoading(false)
    }
  }

  const priceNum = parseFloat(price)
  const priceBelowMin = Boolean(
    publishEstimate && Number.isFinite(priceNum) && priceNum < publishEstimate.minimumViablePrice
  )

  return (
    <>
      <div className="pf-modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="pf-modal" role="dialog" aria-modal="true" aria-label="Finish your design">
        <button
          type="button"
          className="pf-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Step indicator */}
        {step !== 'both-skipped' && (
          <div className="pf-modal-steps" aria-label="Steps">
            <span className={`pf-modal-step${step === 'buy' ? ' pf-modal-step--active' : ''}`}>
              Buy your pair
            </span>
            <span className="pf-modal-step-sep" aria-hidden="true">›</span>
            <span className={`pf-modal-step${step === 'publish' ? ' pf-modal-step--active' : ''}`}>
              Publish to storefront
            </span>
          </div>
        )}

        {/* ── STEP 1: BUY ─────────────────────────────────────────────────── */}
        {step === 'buy' && (
          <div className="pf-modal-body">
            <h3 className="pf-modal-title">Want a pair for yourself?</h3>
            <p className="pf-modal-desc">
              Order the exact shoes you just designed, shipped directly to you — no markup.
            </p>

            {hasSizeOptions && (
              <div>
                <label className="design-tool-label">Your size</label>
                <div className="pf-modal-size-grid">
                  {sameColorVariants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`pf-modal-size-btn${effectiveBuyVariantId === v.id ? ' pf-modal-size-btn--active' : ''}`}
                      onClick={() => {
                        setSelectedBuyVariantId(v.id)
                        setBuyEstimate(null)
                      }}
                    >
                      {v.size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {buyEstimate && (
              <div className="pf-modal-price-callout">
                <span className="pf-modal-price-label">Your price</span>
                <span className="pf-modal-price-value">
                  {formatPricingMoney(buyEstimate.minimumViablePrice, buyEstimate.currency)}
                </span>
                <span className="pf-modal-price-note">Includes fulfillment, shipping &amp; payment processing</span>
              </div>
            )}

            {hasVariant && (
              <PricingEstimatePanel
                productId={productId!}
                variantId={effectiveBuyVariantId!}
                quantity={1}
                onEstimate={setBuyEstimate}
                className="pf-modal-estimate"
              />
            )}

            {buyError && (
              <p className="design-tool-form-error" role="alert">{buyError}</p>
            )}

            <div className="pf-modal-actions">
              <button
                type="button"
                className="pf-modal-btn-primary"
                onClick={handleBuy}
                disabled={buyLoading || !buyEstimate || !effectiveBuyVariantId}
              >
                {buyLoading
                  ? 'Starting checkout…'
                  : buyEstimate
                    ? `Buy my pair — ${formatPricingMoney(buyEstimate.minimumViablePrice, buyEstimate.currency)}`
                    : 'Loading price…'}
              </button>
              <button
                type="button"
                className="pf-modal-btn-ghost"
                onClick={() => setStep('publish')}
                disabled={buyLoading}
              >
                Skip, just browsing →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: PUBLISH ─────────────────────────────────────────────── */}
        {step === 'publish' && (
          <div className="pf-modal-body">
            <h3 className="pf-modal-title">
              {isEditingPublishedProduct ? 'Update your listing' : 'Publish to the storefront?'}
            </h3>
            <p className="pf-modal-desc">
              {isEditingPublishedProduct
                ? 'Update your product name, price, or category.'
                : 'Share your design and earn money each time someone buys a pair.'}
            </p>

            <label htmlFor="pf-name" className="design-tool-label">Product name</label>
            <input
              id="pf-name"
              type="text"
              className="design-tool-input"
              placeholder="My Custom Kicks"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-required
            />

            <label htmlFor="pf-price" className="design-tool-label">Listing price ($)</label>
            <input
              id="pf-price"
              type="number"
              min={publishEstimate ? publishEstimate.minimumViablePrice : 0}
              step={0.01}
              className={`design-tool-input${priceBelowMin ? ' design-tool-input--error' : ''}`}
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              aria-required
            />
            {priceBelowMin && publishEstimate && (
              <p className="design-tool-form-error">
                Minimum {formatPricingMoney(publishEstimate.minimumViablePrice, publishEstimate.currency)}
              </p>
            )}

            {hasVariant && (
              <PricingEstimatePanel
                productId={productId!}
                variantId={printfulVariantId!}
                quantity={1}
                listPriceInput={price}
                onEstimate={setPublishEstimate}
                className="pf-modal-estimate"
              />
            )}

            <label htmlFor="pf-category" className="design-tool-label">Category</label>
            <select
              id="pf-category"
              className="design-tool-select"
              value={categoryId === '' ? '' : String(categoryId)}
              onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {createError && (
              <p className="design-tool-form-error" role="alert">{createError}</p>
            )}

            <div className="pf-modal-actions">
              <button
                type="button"
                className="pf-modal-btn-primary"
                onClick={handlePublish}
                disabled={createLoading || priceBelowMin}
              >
                {createLoading
                  ? (isEditingPublishedProduct ? 'Saving…' : 'Publishing…')
                  : (isEditingPublishedProduct ? 'Save changes' : 'Publish')}
              </button>
              <button
                type="button"
                className="pf-modal-btn-ghost"
                onClick={() => setStep('both-skipped')}
                disabled={createLoading}
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: BOTH SKIPPED ────────────────────────────────────────── */}
        {step === 'both-skipped' && (
          <div className="pf-modal-body pf-modal-body--centered">
            <div className="pf-modal-saved-icon" aria-hidden="true">💾</div>
            <h3 className="pf-modal-title">Design saved as draft</h3>
            <p className="pf-modal-desc">
              No worries — your design is saved. You can buy or publish it any time from your drafts.
            </p>
            <div className="pf-modal-actions pf-modal-actions--centered">
              <button type="button" className="pf-modal-btn-primary" onClick={onClose}>
                Back to designing
              </button>
              <button
                type="button"
                className="pf-modal-btn-ghost"
                onClick={() => router.push('/design-tool/drafts')}
              >
                View my drafts
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
