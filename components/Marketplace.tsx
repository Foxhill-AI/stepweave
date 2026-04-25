'use client'

import { useState, useEffect } from 'react'
import ContentSection from '@/components/ContentSection'
import { productToHomeItem, type HomeItem } from '@/lib/productsForHome'

/**
 * Marketplace browse: same sections as the home page (Trending / Most Popular / Brand New),
 * backed by GET /api/home-products (shoe-category products + engagement).
 */
export default function Marketplace() {
  const [products, setProducts] = useState<HomeItem[]>([])
  const [popularItems, setPopularItems] = useState<HomeItem[]>([])
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
        const homeItems = productRows.map(productToHomeItem)
        setProducts(homeItems)

        type ProductRow = Parameters<typeof productToHomeItem>[0]
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

  const trendingItems = products.slice(0, 12)
  const newItems = products.filter((p) => p.badge === 'New').slice(0, 12)

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
      {!loading && newItems.length > 0 && (
        <ContentSection
          title="Brand New"
          items={newItems}
          pagedGrid
          sectionSlug="brand-new"
        />
      )}
    </>
  )
}
