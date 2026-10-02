'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PricingEstimatePanel, { formatPricingMoney } from './PricingEstimatePanel'
import type { PricingEstimateOk } from '@/lib/printful/pricingEstimate'
import { STRIPE_RATE, PLATFORM_BUFFER_RATE } from '@/lib/printful/pricingEstimate'
import { getModelPricing } from '@/lib/printful/modelPricing'
import type { DesignDraftRow } from '@/lib/supabaseClient'
import { updateDesignDraft, updateProduct, getProductById } from '@/lib/supabaseClient'

type FlowStep = 'buy' | 'publish' | 'both-skipped'

type VariantOption = { id: number; color: string; size: string; image: string }

const CREATOR_TIERS: Record<string, { shareRate: number }> = {
  free:    { shareRate: 0.15 },
  starter: { shareRate: 0.50 },
  pro:     { shareRate: 0.90 },
}

const NEXT_TIER: Record<string, { name: string; shareRate: number; price: string }> = {
  free:    { name: 'Starter', shareRate: 0.50, price: '$9/mo' },
  starter: { name: 'Pro',     shareRate: 0.90, price: '$29/mo' },
}

interface PublishFlowModalProps {
  open: boolean
  onClose: () => void
  draftId: number
  localDraft: DesignDraftRow | null
  printfulVariantId: number | null
  variantOptions?: VariantOption[]
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
  isEditingPublishedProduct,
  designData,
  initialStep,
}: PublishFlowModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<FlowStep>(initialStep ?? 'buy')

  // Buy step state
  const [selectedBuyVariantId, setSelectedBuyVariantId] = useState<number | null>(printfulVariantId)
  const [buyLoading, setBuyLoading] = useState(false)
  const [buyError, setBuyError] = useState<string | null>(null)
  const [buyEstimate, setBuyEstimate] = useState<PricingEstimateOk | null>(null)
  const [showSizeConfirm, setShowSizeConfirm] = useState(false)

  // Publish step state
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)

  // Creator tier (fetched once on open)
  const [creatorTier, setCreatorTier] = useState<string>('free')

  // Fixed price from platform config
  const modelPricing = getModelPricing(localDraft?.base_model_id ?? null)

  useEffect(() => {
    if (!open) return
    fetch('/api/me/account')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const tier = data?.userAccount?.subscription_tier
        if (typeof tier === 'string' && CREATOR_TIERS[tier]) setCreatorTier(tier)
      })
      .catch(() => {})
  }, [open])

  // Pre-fill product name when editing an already-published product.
  useEffect(() => {
    const pid = localDraft?.final_product_id
    if (pid == null || typeof pid !== 'number') return
    let cancelled = false
    getProductById(pid).then((p) => {
      if (cancelled || !p) return
      const row = p as { name?: string }
      if (typeof row.name === 'string' && row.name.trim()) setName(row.name)
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

  const effectiveBuyVariantId = selectedBuyVariantId ?? printfulVariantId
  const hasVariant = productId !== null && effectiveBuyVariantId != null

  // Earnings calculations for publish step
  const margin = modelPricing
    ? Math.max(0, modelPricing.fixedPrice * (1 - STRIPE_RATE - PLATFORM_BUFFER_RATE) - modelPricing.baseCosts)
    : 0
  const currentShareRate = CREATOR_TIERS[creatorTier]?.shareRate ?? 0.15
  const currentEarnings = Math.round(margin * currentShareRate * 100) / 100
  const nextTier = NEXT_TIER[creatorTier] ?? null
  const nextTierEarnings = nextTier ? Math.round(margin * nextTier.shareRate * 100) / 100 : null
  const upgradeHref = `/become-creator?return=${encodeURIComponent(`/design-tool/${draftId}`)}`

  const handleBuyClick = () => {
    if (!effectiveBuyVariantId) {
      setBuyError('Please select a size.')
      return
    }
    setShowSizeConfirm(true)
  }

  const handleBuy = async () => {
    setShowSizeConfirm(false)
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
    if (!modelPricing) {
      setCreateError('This shoe model does not have a configured price. Please contact support.')
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
          price: modelPricing.fixedPrice,
          design_data: { source: 'design_draft' },
        })
        if (!okProduct) { setCreateError('Failed to update product. Please try again.'); return }
        router.push('/profile')
        return
      }

      const res = await fetch(`/api/design-drafts/${draftId}/create-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
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
        {step !== 'both-skipped' && !showSizeConfirm && (
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

        {/* ── SIZE CONFIRMATION (buy step intercept) ──────────────────────── */}
        {showSizeConfirm && (
          <div className="pf-modal-body">
            <h3 className="pf-modal-title">Double-check your size</h3>
            <p className="pf-modal-desc">
              These shoes tend to run a little small.
            </p>
            <p className="pf-modal-desc">
              We recommend sizing up one full size above your typical size. Are you confident in your selection?
            </p>
            <div className="pf-modal-actions">
              <button
                type="button"
                className="pf-modal-btn-primary"
                onClick={handleBuy}
                disabled={buyLoading}
              >
                {buyLoading ? 'Starting checkout…' : 'Yes, this is my size'}
              </button>
              <button
                type="button"
                className="pf-modal-btn-ghost"
                onClick={() => setShowSizeConfirm(false)}
              >
                Let me double-check
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 1: BUY ─────────────────────────────────────────────────── */}
        {step === 'buy' && !showSizeConfirm && (
          <div className="pf-modal-body">
            <h3 className="pf-modal-title">Want a pair for yourself?</h3>
            <p className="pf-modal-desc">
              Order the exact shoes you just designed, shipped directly to you — no markup.
            </p>

            {hasSizeOptions && (
              <div>
                <label className="design-tool-label">Your size</label>
                <div className="pf-modal-size-grid">
                  {[...sameColorVariants].sort((a, b) => {
                    const na = parseFloat(a.size), nb = parseFloat(b.size)
                    if (!isNaN(na) && !isNaN(nb)) return na - nb
                    return a.size.localeCompare(b.size)
                  }).map((v) => (
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
                <p className="pf-modal-size-tip">These shoes run small — we recommend ordering one size up from your usual.</p>
              </div>
            )}

            {buyEstimate && (
              <div className="pf-modal-price-callout">
                <span className="pf-modal-price-label">Your price</span>
                <span className="pf-modal-price-value">
                  {formatPricingMoney(buyEstimate.minimumViablePrice, buyEstimate.currency)}
                </span>
                <span className="pf-modal-price-note">Free shipping!</span>
              </div>
            )}

            {/* Hidden — only used to fetch the estimate for the price callout above. */}
            {hasVariant && (
              <div hidden>
                <PricingEstimatePanel
                  productId={productId!}
                  variantId={effectiveBuyVariantId!}
                  quantity={1}
                  onEstimate={setBuyEstimate}
                />
              </div>
            )}

            {buyError && (
              <p className="design-tool-form-error" role="alert">{buyError}</p>
            )}

            <div className="pf-modal-actions">
              <button
                type="button"
                className="pf-modal-btn-primary"
                onClick={handleBuyClick}
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
                ? 'Update your product name.'
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

            <div className="pf-modal-fixed-price">
              <span className="pf-modal-fixed-price-label">Listing price</span>
              <span className="pf-modal-fixed-price-value">
                {modelPricing ? formatPricingMoney(modelPricing.fixedPrice, 'USD') : '—'}
              </span>
            </div>

            {/* Earnings breakdown */}
            {modelPricing && !isEditingPublishedProduct && (
              <div className="pf-modal-earnings">
                <div className="pf-modal-earnings-row">
                  <span className="pf-modal-earnings-label">
                    You earn per sale
                    <span className="pf-modal-earnings-detail">
                      {Math.round(currentShareRate * 100)}% of margin · {creatorTier} plan
                    </span>
                  </span>
                  <span className="pf-modal-earnings-amount">
                    {formatPricingMoney(currentEarnings, 'USD')}
                  </span>
                </div>

                {nextTier && nextTierEarnings !== null && (
                  <div className="pf-modal-earnings-row pf-modal-earnings-row--upgrade">
                    <span className="pf-modal-earnings-label">
                      On {nextTier.name} ({nextTier.price})
                      <span className="pf-modal-earnings-detail">
                        {Math.round(nextTier.shareRate * 100)}% of margin
                      </span>
                    </span>
                    <span className="pf-modal-earnings-amount pf-modal-earnings-amount--upgrade">
                      {formatPricingMoney(nextTierEarnings, 'USD')}
                    </span>
                  </div>
                )}

                {nextTier && nextTierEarnings !== null && (
                  <a href={upgradeHref} className="pf-modal-upgrade-btn">
                    Upgrade to {nextTier.name} and earn {formatPricingMoney(nextTierEarnings, 'USD')} per sale →
                  </a>
                )}
              </div>
            )}

            {createError && (
              <p className="design-tool-form-error" role="alert">{createError}</p>
            )}

            <div className="pf-modal-actions">
              <button
                type="button"
                className="pf-modal-btn-primary"
                onClick={handlePublish}
                disabled={createLoading || !modelPricing}
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
