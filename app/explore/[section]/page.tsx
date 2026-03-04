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
  productToHomeItem,
  SECTION_SLUG_TO_TITLE,
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
    getActiveProducts()
      .then((rows) => {
        if (cancelled) return
        const list = rows.map(productToHomeItem)
        setItems(list)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [isValid])

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
            <>
              <ContentSection
                title={title ?? sectionSlug}
                items={items}
                showAsGrid={true}
              />
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
