'use client'

import { useEffect, useRef, useState } from 'react'
import type { PricingEstimateOk } from '@/lib/printful/pricingEstimate'
import { STRIPE_RATE, STRIPE_FIXED, PLATFORM_BUFFER_RATE } from '@/lib/printful/pricingEstimate'

export function formatPricingMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

const NEXT_TIER: Record<string, { name: string; shareRate: number; price: string }> = {
  free:    { name: 'Starter', shareRate: 0.50, price: '$9/mo' },
  starter: { name: 'Pro',     shareRate: 0.90, price: '$29/mo' },
}

type TierInfo = { tier: string; shareRate: number }

type Props = {
  productId: string | null
  variantId: number | null
  quantity?: number
  onEstimate?: (estimate: PricingEstimateOk | null) => void
  /** Current list price for profit calculation and minimum enforcement. */
  listPriceInput?: string
  /** Path to return to after an upgrade (e.g. "/design-tool/123"). Enables the upgrade nudge. */
  returnPath?: string
  className?: string
}

export default function PricingEstimatePanel({
  productId,
  variantId,
  quantity = 1,
  onEstimate,
  listPriceInput = '',
  returnPath,
  className = '',
}: Props) {
  const onEstimateRef = useRef(onEstimate)
  onEstimateRef.current = onEstimate

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PricingEstimateOk | null>(null)
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null)

  useEffect(() => {
    if (!productId || variantId == null) {
      setData(null)
      setTierInfo(null)
      setError(null)
      setLoading(false)
      onEstimateRef.current?.(null)
      return
    }

    let cancelled = false
    const timeoutId = setTimeout(() => {
      onEstimateRef.current?.(null)
      setLoading(true)
      setError(null)
      fetch('/api/printful/pricing-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, variantId, quantity }),
      })
        .then(async (res) => {
          const json = await res.json().catch(() => ({}))
          if (!res.ok) {
            throw new Error(typeof json.error === 'string' ? json.error : 'Could not estimate pricing.')
          }
          return json as PricingEstimateOk & { creatorTier?: string; creatorShareRate?: number }
        })
        .then((est) => {
          if (cancelled) return
          if (!est || est.ok !== true) {
            setData(null)
            setTierInfo(null)
            onEstimateRef.current?.(null)
            return
          }
          setData(est)
          setTierInfo({
            tier: typeof est.creatorTier === 'string' ? est.creatorTier : 'free',
            shareRate: typeof est.creatorShareRate === 'number' ? est.creatorShareRate : 0.15,
          })
          onEstimateRef.current?.(est)
        })
        .catch((e: unknown) => {
          if (cancelled) return
          setData(null)
          setTierInfo(null)
          setError(e instanceof Error ? e.message : 'Could not estimate pricing.')
          onEstimateRef.current?.(null)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 320)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [productId, variantId, quantity])

  useEffect(() => {
    return () => { onEstimateRef.current?.(null) }
  }, [])

  if (!productId || variantId == null) return null

  const priceNum = parseFloat(listPriceInput)
  const hasPrice = Number.isFinite(priceNum) && priceNum > 0

  const stripeFee = hasPrice ? Math.round((priceNum * STRIPE_RATE + STRIPE_FIXED) * 100) / 100 : null

  // Net margin after Stripe rate + platform buffer, minus Printful cost.
  const margin =
    data && hasPrice && stripeFee !== null && priceNum >= data.minimumViablePrice
      ? Math.max(0, priceNum * (1 - STRIPE_RATE - PLATFORM_BUFFER_RATE) - data.baseCosts)
      : null

  const shareRate = tierInfo?.shareRate ?? 0.15
  const profitPerSale = margin !== null ? Math.round(margin * shareRate * 100) / 100 : null

  const currentTier = tierInfo?.tier ?? 'free'
  const nextTier = NEXT_TIER[currentTier] ?? null
  const nextTierProfit =
    margin !== null && nextTier
      ? Math.round(margin * nextTier.shareRate * 100) / 100
      : null

  const upgradeHref = returnPath
    ? `/become-creator?return=${encodeURIComponent(returnPath)}`
    : '/become-creator'

  return (
    <div className={`design-tool-pricing-estimate ${className}`.trim()} role="region" aria-label="Cost estimate">
      <h4 className="design-tool-pricing-estimate-title">Estimated costs</h4>

      {loading && <p className="design-tool-pricing-estimate-status">Calculating…</p>}
      {error && !loading && (
        <p className="design-tool-pricing-estimate-error" role="alert">{error}</p>
      )}

      {data && !loading && (
        <>
          <ul className="design-tool-pricing-estimate-list">
            {data.lines.map((line) => {
              if (line.key === 'shipping') {
                return (
                  <li key={line.key} className="design-tool-pricing-estimate-row">
                    <span className="design-tool-pricing-estimate-label">Shipping</span>
                    <span className="design-tool-pricing-estimate-amount design-tool-pricing-estimate-amount--free">
                      Free
                    </span>
                  </li>
                )
              }
              return (
                <li key={line.key} className="design-tool-pricing-estimate-row">
                  <span className="design-tool-pricing-estimate-label">{line.label}</span>
                  <span className="design-tool-pricing-estimate-amount">
                    {formatPricingMoney(line.amount, data.currency)}
                  </span>
                </li>
              )
            })}

            <li className="design-tool-pricing-estimate-row">
              <span className="design-tool-pricing-estimate-label">
                Payment processing
                <span className="design-tool-pricing-estimate-detail">2.9% + $0.30 per transaction</span>
              </span>
              <span className="design-tool-pricing-estimate-amount">
                {stripeFee !== null ? formatPricingMoney(stripeFee, data.currency) : '—'}
              </span>
            </li>

            <li className="design-tool-pricing-estimate-row design-tool-pricing-estimate-row--total">
              <span className="design-tool-pricing-estimate-label">Estimated total cost</span>
              <span className="design-tool-pricing-estimate-amount">
                {stripeFee !== null
                  ? formatPricingMoney(data.baseCosts + stripeFee, data.currency)
                  : formatPricingMoney(data.baseCosts, data.currency)}
              </span>
            </li>

            {profitPerSale !== null && (
              <>
                <li className="design-tool-pricing-estimate-row design-tool-pricing-estimate-row--profit-label">
                  <span className="design-tool-pricing-estimate-label">
                    Your profit margin
                    <span className="design-tool-pricing-estimate-detail">
                      {Math.round(shareRate * 100)}% of net margin · {currentTier} plan
                    </span>
                  </span>
                  <span className="design-tool-pricing-estimate-amount design-tool-pricing-estimate-amount--highlight">
                    {formatPricingMoney(profitPerSale, data.currency)}/sale
                  </span>
                </li>

                {nextTier && nextTierProfit !== null && (
                  <li className="design-tool-pricing-estimate-row design-tool-pricing-estimate-row--upgrade-hint">
                    <span className="design-tool-pricing-estimate-label">
                      On {nextTier.name} ({nextTier.price})
                      <span className="design-tool-pricing-estimate-detail">
                        {Math.round(nextTier.shareRate * 100)}% of net margin
                      </span>
                    </span>
                    <span className="design-tool-pricing-estimate-amount design-tool-pricing-estimate-amount--upgrade">
                      {formatPricingMoney(nextTierProfit, data.currency)}/sale
                    </span>
                  </li>
                )}
              </>
            )}
          </ul>

          {nextTier && nextTierProfit !== null && profitPerSale !== null && (
            <a
              href={upgradeHref}
              className="design-tool-pricing-estimate-upgrade-btn"
            >
              Upgrade to {nextTier.name} and earn {formatPricingMoney(nextTierProfit, data.currency)} per sale →
            </a>
          )}

          <p className="design-tool-pricing-estimate-note design-tool-pricing-estimate-note--muted">
            {data.note}
          </p>
        </>
      )}
    </div>
  )
}
