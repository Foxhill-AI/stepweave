'use client'

import { useMemo, useState, useEffect } from 'react'
import ContentSection from '@/components/ContentSection'
import {
  homeItemsFromProductRows,
  productToHomeItem,
} from '@/lib/productsForHome'
import {
  filterListingsByShoeAudience,
  SHOE_AUDIENCE_FILTER_OPTIONS,
  type ShoeAudienceFilter,
} from '@/lib/shoeAudience'
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
  const [shoeFilter, setShoeFilter] = useState<ShoeAudienceFilter>('all')
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

  const filteredProductRows = useMemo(
    () => filterListingsByShoeAudience(productRows, shoeFilter),
    [productRows, shoeFilter]
  )
  const filteredPopularRows = useMemo(
    () => filterListingsByShoeAudience(popularRows, shoeFilter),
    [popularRows, shoeFilter]
  )
  const filteredBrandNewRows = useMemo(
    () => filterListingsByShoeAudience(brandNewRows, shoeFilter),
    [brandNewRows, shoeFilter]
  )

  const products = useMemo(
    () => homeItemsFromProductRows(filteredProductRows, viewsByProductId),
    [filteredProductRows, viewsByProductId]
  )
  const popularItems = useMemo(
    () =>
      filteredPopularRows.map((row) => {
        const base = productToHomeItem(row)
        const key = String(row.id)
        const n = popularEngagement[key]
        const likes = typeof n === 'number' && n >= 0 ? n : base.likes
        return { ...base, likes }
      }),
    [filteredPopularRows, popularEngagement]
  )
  const brandNewItems = useMemo(
    () => homeItemsFromProductRows(filteredBrandNewRows, viewsByProductId),
    [filteredBrandNewRows, viewsByProductId]
  )

  const trendingItems = products
  const hasAnyProducts = productRows.length > 0
  const hasFilteredProducts =
    filteredProductRows.length > 0 ||
    filteredPopularRows.length > 0 ||
    filteredBrandNewRows.length > 0

  const emptyFilterLabel =
    SHOE_AUDIENCE_FILTER_OPTIONS.find((o) => o.value === shoeFilter)?.label ?? 'this filter'

  return (
    <>
      <div className="marketplace-shoe-filter-wrap">
        <div className="marketplace-shoe-filter" role="group" aria-label="Shoe type">
          {SHOE_AUDIENCE_FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`marketplace-shoe-filter-btn${
                shoeFilter === value ? ' marketplace-shoe-filter-btn-active' : ''
              }`}
              aria-pressed={shoeFilter === value}
              onClick={() => setShoeFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

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
      {!loading && hasAnyProducts && !hasFilteredProducts && (
        <p className="homepage-empty" aria-live="polite">
          No products match {emptyFilterLabel.toLowerCase()}. Try another filter.
        </p>
      )}
      {!loading && trendingItems.length > 0 && (
        <ContentSection
          title="Trending Now"
          items={trendingItems}
          pagedGrid
          sectionSlug="trending-now"
          gridLayout="responsive-trending"
          initialVisibleCount={3}
          loadMoreCount={6}
        />
      )}
      {!loading && popularItems.length > 0 && (
        <ContentSection
          title="Most Popular"
          items={popularItems}
          pagedGrid
          sectionSlug="most-popular"
          initialVisibleCount={3}
          loadMoreCount={6}
        />
      )}
      {!loading && brandNewItems.length > 0 && (
        <ContentSection
          title="Brand New"
          items={brandNewItems}
          pagedGrid
          sectionSlug="brand-new"
          initialVisibleCount={3}
          loadMoreCount={6}
        />
      )}
    </>
  )
}
