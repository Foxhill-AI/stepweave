'use client'

import { useEffect, useRef, useState } from 'react'
import type { PricingEstimateOk } from '@/lib/printful/pricingEstimate'

export function formatPricingMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

type Props = {
  productId: string | null
  variantId: number | null
  quantity?: number
  onEstimate?: (estimate: PricingEstimateOk | null) => void
  /** Current list price for warnings (optional). */
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
    return () => {
      onEstimateRef.current?.(null)
    }
  }, [])

  if (!productId || variantId == null) {
    return null
  }

  const priceNum = parseFloat(listPriceInput)
  const hasPrice = Number.isFinite(priceNum) && priceNum >= 0

  return (
    <div className={`design-tool-pricing-estimate ${className}`.trim()} role="region" aria-label="Cost estimate">
      <h4 className="design-tool-pricing-estimate-title">Estimated costs (Printful)</h4>
      <p className="design-tool-pricing-estimate-recipient">
        Shipping sample destination:{' '}
        {data?.recipientSummary ?? 'US — configure PRINTFUL_PRICING_SHIP_* env to customize.'}
      </p>

      {loading && <p className="design-tool-pricing-estimate-status">Calculating…</p>}
      {error && !loading && (
        <p className="design-tool-pricing-estimate-error" role="alert">
          {error}
        </p>
      )}

      {data && !loading && (
        <>
          <ul className="design-tool-pricing-estimate-list">
            {data.lines.map((line) => (
              <li key={line.key} className="design-tool-pricing-estimate-row">
                <span className="design-tool-pricing-estimate-label">
                  {line.label}
                  {line.detail ? (
                    <span className="design-tool-pricing-estimate-detail">{line.detail}</span>
                  ) : null}
                </span>
                <span className="design-tool-pricing-estimate-amount">
                  {formatPricingMoney(line.amount, data.currency)}
                </span>
              </li>
            ))}
            <li className="design-tool-pricing-estimate-row design-tool-pricing-estimate-row--total">
              <span className="design-tool-pricing-estimate-label">Total estimated cost</span>
              <span className="design-tool-pricing-estimate-amount">
                {formatPricingMoney(data.totalCost, data.currency)}
              </span>
            </li>
            <li className="design-tool-pricing-estimate-row design-tool-pricing-estimate-row--recommend">
              <span className="design-tool-pricing-estimate-label">
                Recommended minimum ({Math.round(data.marginRate * 100)}% margin)
              </span>
              <span className="design-tool-pricing-estimate-amount design-tool-pricing-estimate-amount--highlight">
                {formatPricingMoney(data.recommendedMinimum, data.currency)}
              </span>
            </li>
          </ul>
          <p className="design-tool-pricing-estimate-note">{data.printScopeNote}</p>
          <p className="design-tool-pricing-estimate-note design-tool-pricing-estimate-note--muted">
            {data.note}
          </p>

          {hasPrice && priceNum < data.totalCost && (
            <p className="design-tool-pricing-estimate-block" role="alert">
              Your list price is below the estimated total cost. Increase the price to avoid losing money on
              each sale.
            </p>
          )}
          {hasPrice && priceNum >= data.totalCost && priceNum < data.recommendedMinimum && (
            <p className="design-tool-pricing-estimate-warn">
              Your price covers estimated costs but is below the recommended minimum for a{' '}
              {Math.round(data.marginRate * 100)}% margin.
            </p>
          )}
        </>
      )}
    </div>
  )
}
