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

/** Seller's profit split. Will come from user tier in future; default 15%. */
const SELLER_MARGIN_RATE = 0.15

type Props = {
  productId: string | null
  variantId: number | null
  quantity?: number
  onEstimate?: (estimate: PricingEstimateOk | null) => void
  /** Current list price for profit calculation and minimum enforcement. */
  listPriceInput?: string
  className?: string
}

export default function PricingEstimatePanel({
  productId,
  variantId,
  quantity = 1,
  onEstimate,
  listPriceInput = '',
  className = '',
}: Props) {
  const onEstimateRef = useRef(onEstimate)
  onEstimateRef.current = onEstimate

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PricingEstimateOk | null>(null)

  useEffect(() => {
    if (!productId || variantId == null) {
      setData(null)
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
          return json as PricingEstimateOk
        })
        .then((est) => {
          if (cancelled) return
          if (!est || est.ok !== true) {
            setData(null)
            onEstimateRef.current?.(null)
            return
          }
          setData(est)
          onEstimateRef.current?.(est)
        })
        .catch((e: unknown) => {
          if (cancelled) return
          setData(null)
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

  // Stripe fee at current price (dynamic)
  const stripeFee = hasPrice ? Math.round((priceNum * STRIPE_RATE + STRIPE_FIXED) * 100) / 100 : null

  // Profit calculation:
  //   margin = price - baseCosts - stripe_fee - price * PLATFORM_BUFFER_RATE
  //   seller profit = margin * SELLER_MARGIN_RATE
  let profitPerSale: number | null = null
  if (data && hasPrice && stripeFee !== null && priceNum >= data.minimumViablePrice) {
    const margin = priceNum - data.baseCosts - stripeFee - priceNum * PLATFORM_BUFFER_RATE
    profitPerSale = Math.max(0, Math.round(margin * SELLER_MARGIN_RATE * 100) / 100)
  }

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

            {/* Stripe fee — dynamic based on current price */}
            <li className="design-tool-pricing-estimate-row">
              <span className="design-tool-pricing-estimate-label">
                Payment processing
                <span className="design-tool-pricing-estimate-detail">2.9% + $0.30 per transaction</span>
              </span>
              <span className="design-tool-pricing-estimate-amount">
                {stripeFee !== null
                  ? formatPricingMoney(stripeFee, data.currency)
                  : '—'}
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
                  <span className="design-tool-pricing-estimate-label">Your profit margin</span>
                  <span className="design-tool-pricing-estimate-amount design-tool-pricing-estimate-amount--highlight">
                    {Math.round(SELLER_MARGIN_RATE * 100)}%
                  </span>
                </li>
                <li className="design-tool-pricing-estimate-row design-tool-pricing-estimate-row--profit">
                  <span className="design-tool-pricing-estimate-label">Your profit per sale</span>
                  <span className="design-tool-pricing-estimate-amount design-tool-pricing-estimate-amount--highlight">
                    {formatPricingMoney(profitPerSale, data.currency)}
                  </span>
                </li>
              </>
            )}
          </ul>

          <p className="design-tool-pricing-estimate-note design-tool-pricing-estimate-note--muted">
            {data.note}
          </p>
        </>
      )}
    </div>
  )
}
