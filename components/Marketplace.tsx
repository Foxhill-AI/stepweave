'use client'

import { useMemo, useState, useEffect } from 'react'
import ContentSection from '@/components/ContentSection'
import {
  homeItemsFromProductRows,
  productToHomeItem,
} from '@/lib/productsForHome'
import type { ProductListingRow } from '@/lib/supabaseClient'

/**
 * Marketplace browse: Trending = **all** active products (view-sorted, first 3 visible),
 * plus Most Popular and Brand New from GET /api/home-products.
 */
export default function Marketplace() {
  const [productRows, setProductRows] = useState<ProductListingRow[]>([])
  const [popularRows, setPopularRows] = useState<ProductListingRow[]>([])
  const [brandNewRows, setBrandNewRows] = useState<ProductListingRow[]>([])
  const [popularEngagement, setPopularEngagement] = useState<Record<string, number>>({})
  const [viewsByProductId, setViewsByProductId] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timeoutMs = 12000
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    fetch('/api/home-products', { signal: controller.signal, cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setProductRows((data?.products ?? []) as ProductListingRow[])
        setViewsByProductId((data?.viewsByProductId ?? {}) as Record<string, number>)
        setBrandNewRows((data?.brandNewProducts ?? []) as ProductListingRow[])
        setPopularRows((data?.popularProducts ?? []) as ProductListingRow[])
        setPopularEngagement((data?.popularEngagement ?? {}) as Record<string, number>)
      })
      .catch(() => {
        if (!cancelled) {
          setProductRows([])
          setBrandNewRows([])
          setPopularRows([])
          setPopularEngagement({})
          setViewsByProductId({})
        }
      })
      .finally(() => {
        clearTimeout(timeoutId)
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timeoutId)
    }
  }, [])

  const products = useMemo(
    () => homeItemsFromProductRows(productRows, viewsByProductId),
    [productRows, viewsByProductId]
  )
  const popularItems = useMemo(
    () =>
      popularRows.map((row) => {
        const base = productToHomeItem(row)
        const key = String(row.id)
        const n = popularEngagement[key]
        const likes = typeof n === 'number' && n >= 0 ? n : base.likes
        return { ...base, likes }
      }),
    [popularRows, popularEngagement]
  )
  const brandNewItems = useMemo(
    () => homeItemsFromProductRows(brandNewRows, viewsByProductId),
    [brandNewRows, viewsByProductId]
  )

  const trendingItems = products
  const hasAnyProducts = productRows.length > 0

  return (
    <>
      {loading && (
        <p className="homepage-loading" aria-live="polite">
          Loading products…
        </p>
      )}
      {!loading && !hasAnyProducts && (
        <p className="homepage-empty" aria-live="polite">
          No products yet. Check back later.
        </p>
      )}
      {!loading && trendingItems.length > 0 && (
        <ContentSection
          title="Trending Now"
          items={trendingItems}
          pagedGrid
          sectionSlug="trending-now"
          gridLayout="responsive-trending"
        />
      )}
      {!loading && popularItems.length > 0 && (
        <ContentSection
          title="Most Popular"
          items={popularItems}
          pagedGrid
          sectionSlug="most-popular"
        />
      )}
      {!loading && brandNewItems.length > 0 && (
        <ContentSection
          title="Brand New"
          items={brandNewItems}
          pagedGrid
          sectionSlug="brand-new"
        />
      )}
    </>
  )
}
