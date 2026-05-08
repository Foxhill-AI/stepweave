'use client'

import { useState, useEffect } from 'react'
import ContentSection from '@/components/ContentSection'
import {
  homeItemsFromProductRows,
  productToHomeItem,
  type HomeItem,
} from '@/lib/productsForHome'

/**
 * Marketplace browse: Trending = **all** active products (view-sorted, first 3 visible),
 * plus Most Popular and Brand New from GET /api/home-products.
 */
export default function Marketplace() {
  const [products, setProducts] = useState<HomeItem[]>([])
  const [popularItems, setPopularItems] = useState<HomeItem[]>([])
  const [brandNewItems, setBrandNewItems] = useState<HomeItem[]>([])
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
        const productRows = data?.products ?? []
        const viewsById = (data?.viewsByProductId ?? {}) as Record<string, number>
        const homeItems = homeItemsFromProductRows(productRows, viewsById)
        setProducts(homeItems)

        type ProductRow = Parameters<typeof productToHomeItem>[0]
        setBrandNewItems(
          homeItemsFromProductRows((data?.brandNewProducts ?? []) as ProductRow[], viewsById)
        )

        const popRows = (data?.popularProducts ?? []) as ProductRow[]
        const engagement = (data?.popularEngagement ?? {}) as Record<string, number>
        setPopularItems(
          popRows.map((row) => {
            const base = productToHomeItem(row)
            const key = String(row.id)
            const n = engagement[key]
            const likes = typeof n === 'number' && n >= 0 ? n : base.likes
            return { ...base, likes }
          })
        )
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([])
          setBrandNewItems([])
          setPopularItems([])
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

  const trendingItems = products

  return (
    <>
      {loading && (
        <p className="homepage-loading" aria-live="polite">
          Loading products…
        </p>
      )}
      {!loading && products.length === 0 && (
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
