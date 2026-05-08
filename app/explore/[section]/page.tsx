'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import ContentSection from '@/components/ContentSection'
import { getActiveProducts } from '@/lib/supabaseClient'
import {
  homeItemsFromProductRows,
  productToHomeItem,
  SECTION_SLUG_TO_TITLE,
  sortProductRowsNewestFirst,
  VALID_SECTION_SLUGS,
  type HomeItem,
} from '@/lib/productsForHome'
import '../../homepage.css'

export default function ExploreSectionPage() {
  const params = useParams()
  const sectionSlug = typeof params.section === 'string' ? params.section : ''
  const [items, setItems] = useState<HomeItem[]>([])
  const [loading, setLoading] = useState(true)

  const title = sectionSlug ? SECTION_SLUG_TO_TITLE[sectionSlug] : null
  const isValid = sectionSlug && VALID_SECTION_SLUGS.includes(sectionSlug)

  useEffect(() => {
    if (!isValid) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    if (sectionSlug === 'most-popular') {
      fetch('/api/most-popular-products', { cache: 'no-store' })
        .then((res) => res.json())
        .then((data: { products?: unknown[]; popularEngagement?: Record<string, number> }) => {
          if (cancelled) return
          const rows = data?.products ?? []
          const engagement = data?.popularEngagement ?? {}
          const list = rows.map((row) => {
            const base = productToHomeItem(row as Parameters<typeof productToHomeItem>[0])
            const id = String((row as { id: number }).id)
            const n = engagement[id]
            const likes = typeof n === 'number' && n >= 0 ? n : base.likes
            return { ...base, likes }
          })
          setItems(list)
        })
        .catch(() => {
          if (!cancelled) setItems([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }

    if (sectionSlug === 'trending-now') {
      fetch('/api/trending-products', { cache: 'no-store' })
        .then((res) => res.json())
        .then(
          (data: {
            products?: unknown[]
            viewsByProductId?: Record<string, number>
          }) => {
            if (cancelled) return
            const rows = data?.products ?? []
            const viewsById = data?.viewsByProductId ?? {}
            type Row = Parameters<typeof productToHomeItem>[0]
            setItems(homeItemsFromProductRows(rows as Row[], viewsById))
          }
        )
        .catch(() => {
          if (!cancelled) setItems([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }

    getActiveProducts()
      .then((rows) => {
        if (cancelled) return
        if (sectionSlug === 'brand-new') {
          setItems(sortProductRowsNewestFirst(rows).map(productToHomeItem))
        }
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isValid, sectionSlug])

  if (!sectionSlug || !isValid) {
    return (
      <div className="homepage">
        <Navbar />
        <Subnavbar />
        <main className="homepage-main" role="main">
          <div className="container">
            <p className="homepage-empty">Section not found.</p>
            <Link href="/" className="explore-back-link">Back to home</Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="homepage">
      <Navbar />
      <Subnavbar />
      <main className="homepage-main" role="main">
        <div className="container">
          {loading ? (
            <p className="homepage-loading" aria-live="polite">
              Loading…
            </p>
          ) : (
            <ContentSection
              title={title ?? sectionSlug}
              items={items}
              showAsGrid
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
