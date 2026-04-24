'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import HeroSection, { type HeroSectionData } from '@/components/HeroSection'
import ContentSection from '@/components/ContentSection'
import AdBanner from '@/components/AdBanner'
import { productToHomeItem, type HomeItem } from '@/lib/productsForHome'
import './homepage.css'



export default function HomePage() {
  const TRENDING_BATCH_SIZE = 6
  const [products, setProducts] = useState<HomeItem[]>([])
  /** Ranked by likes + saves (all users); from /api/home-products popularProducts. */
  const [popularItems, setPopularItems] = useState<HomeItem[]>([])
  const [heroSections, setHeroSections] = useState<HeroSectionData[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleTrendingCount, setVisibleTrendingCount] = useState(TRENDING_BATCH_SIZE)

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
        const featuredCreators = data?.featuredCreators ?? []
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
        if (featuredCreators.length > 0) {
          setHeroSections(
            featuredCreators.map((creator: { profile: HeroSectionData['profile']; products: unknown[] }) => ({
              profile: {
                avatar: creator.profile.avatar,
                name: creator.profile.name,
                followers: creator.profile.followers,
                description: creator.profile.description,
                username: creator.profile.name,
                userAccountId: creator.profile.userAccountId,
              },
              items: creator.products.map((row: unknown, i: number) => {
                const item = productToHomeItem(row as Parameters<typeof productToHomeItem>[0])
                return {
                  ...item,
                  image: item.image ?? '',
                  author: item.author || creator.profile.name,
                  badge: ['Featured', 'New Release', 'Trending'][i] ?? undefined,
                }
              }),
            }))
          )
        } else if (productRows.length > 0) {
          // Fallback: e.g. products missing user_account_id — one slide with newest items
          type Row = Parameters<typeof productToHomeItem>[0]
          const rows = productRows as Row[]
          const first = rows[0]
          const uname =
            (first as { user_account?: { username?: string } }).user_account?.username?.trim() || 'Creator'
          const uid = (first as { user_account_id?: number }).user_account_id
          setHeroSections([
            {
              profile: {
                avatar: uname.charAt(0).toUpperCase(),
                name: uname,
                followers: '',
                description: '',
                username: uname,
                userAccountId: typeof uid === 'number' ? uid : undefined,
              },
              items: rows.slice(0, 3).map((row, i) => {
                const item = productToHomeItem(row)
                return {
                  ...item,
                  image: item.image ?? '',
                  author: item.author || uname,
                  badge: ['Featured', 'New Release', 'Trending'][i] ?? undefined,
                }
              }),
            },
          ])
        } else {
          setHeroSections([])
        }
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
  const visibleTrendingItems = trendingItems.slice(0, visibleTrendingCount)
  const hasMoreTrending = visibleTrendingCount < trendingItems.length
  /** Only listings with the "New" badge (created within the last 7 days). */
  const newItems = products.filter((p) => p.badge === 'New').slice(0, 12)
  const digitalItems = products.slice(0, 8)

  return (
    <div className="homepage">
      <Navbar />

      <Subnavbar />

      <main className="homepage-main" role="main">
        {!loading && heroSections.length > 0 && (
          <HeroSection sections={heroSections} />
        )}

        <AdBanner />

        <div className="container">
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
            <>
              <ContentSection
                title="Trending Now"
                items={visibleTrendingItems}
                showAsGrid={true}
                gridLayout="responsive-trending"
                sectionSlug="trending-now"
              />
              {hasMoreTrending && (
                <div className="homepage-show-more-wrap">
                  <button
                    type="button"
                    className="homepage-show-more-button"
                    onClick={() =>
                      setVisibleTrendingCount((count) =>
                        Math.min(count + TRENDING_BATCH_SIZE, trendingItems.length)
                      )
                    }
                  >
                    Show more
                  </button>
                </div>
              )}
            </>
          )}
          {!loading && popularItems.length > 0 && (
            <ContentSection
              title="Most Popular"
              items={popularItems}
              showAsCarousel={true}
              sectionSlug="most-popular"
            />
          )}
          {!loading && newItems.length > 0 && (
            <ContentSection
              title="Brand New"
              items={newItems}
              showAsCarousel={true}
              sectionSlug="brand-new"
            />
          )}
          {!loading && digitalItems.length > 0 && (
            <ContentSection
              title="Digital Designs"
              items={digitalItems}
              showAsCarousel={true}
              sectionSlug="digital-designs"
            />
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
