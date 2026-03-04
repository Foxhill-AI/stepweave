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
  const [products, setProducts] = useState<HomeItem[]>([])
  const [heroSections, setHeroSections] = useState<HeroSectionData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timeoutMs = 12000
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    fetch('/api/home-products', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const productRows = data?.products ?? []
        const featuredCreators = data?.featuredCreators ?? []
        setProducts(productRows.map(productToHomeItem))
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
        } else {
          const heroProducts = productRows.map(productToHomeItem)
          if (heroProducts.length >= 3) {
            setHeroSections([
              { profile: { avatar: 'K', name: 'Kreations', followers: '3.5k followers', description: 'Bringing beautiful creatures to life with 3D printing. Explore unique designs and join our creative community.' }, items: heroProducts.slice(0, 3).map((item: HomeItem, i: number) => ({ ...item, image: item.image ?? '', badge: ['Featured', 'New Release', 'Trending'][i] })) },
              { profile: { avatar: 'FM', name: 'Fotis Mint', followers: '14K followers', description: 'Creating Busts, Figures, and Miniatures for both resin and FDM 3D printing.' }, items: heroProducts.slice(3, 6).map((item: HomeItem, i: number) => ({ ...item, image: item.image ?? '', badge: ['Featured', 'New Release', 'Trending'][i] })) },
              { profile: { avatar: 'DS', name: 'Design Studio', followers: '8.2k followers', description: 'Professional 3D models and digital art. High-quality assets for creators and designers.' }, items: heroProducts.slice(6, 9).map((item: HomeItem, i: number) => ({ ...item, image: item.image ?? '', badge: ['Featured', 'New Release', 'Trending'][i] })) },
            ])
          }
        }
      })
      .catch(() => {
        if (!cancelled) setProducts([])
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

  // Mismo listado (ordenado por created_at desc) repartido en secciones; luego podrás filtrar por métricas/categoría
  const trendingItems = products.slice(0, 12)
  const popularItems = products.slice(0, 12)
  const newItems = products.slice(0, 12)
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
            <ContentSection
              title="Trending Now"
              items={trendingItems}
              showAsCarousel={true}
              sectionSlug="trending-now"
            />
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
