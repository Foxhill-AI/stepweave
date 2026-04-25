'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import ItemCard from './ItemCard'
import Carousel from './Carousel'
import '../styles/ContentSection.css'
import {
  HOME_SECTION_GRID_INITIAL_COUNT,
  HOME_SECTION_GRID_LOAD_MORE_COUNT,
} from '@/lib/homeSectionGridConfig'

interface Item {
  id: string
  title: string
  category: string
  image?: string
  views?: number
  likes?: number
  downloads?: number
  author?: string
  price?: string
  rating?: number
  badge?: string
}

interface ContentSectionProps {
  title: string
  items: Item[]
  showAsCarousel?: boolean
  showAsGrid?: boolean
  gridLayout?: 'auto' | 'single-column' | 'responsive-trending'
  /** Slug for “View all” → `/explore/[slug]` (carousel or paged grid). */
  sectionSlug?: string
  /**
   * Home / marketplace: responsive grid, show `HOME_SECTION_GRID_INITIAL_COUNT` items first,
   * then “View more” in steps of `HOME_SECTION_GRID_LOAD_MORE_COUNT` (see `lib/homeSectionGridConfig.ts`).
   */
  pagedGrid?: boolean
  /** Optional override of initial visible count (defaults from config). */
  initialVisibleCount?: number
  /** Optional override of each “View more” increment (defaults from config). */
  loadMoreCount?: number
}

export default function ContentSection({
  title,
  items,
  showAsCarousel = true,
  showAsGrid = false,
  gridLayout = 'auto',
  sectionSlug,
  pagedGrid = false,
  initialVisibleCount,
  loadMoreCount,
}: ContentSectionProps) {
  const resolvedInitial = initialVisibleCount ?? HOME_SECTION_GRID_INITIAL_COUNT
  const resolvedStep = loadMoreCount ?? HOME_SECTION_GRID_LOAD_MORE_COUNT
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(resolvedInitial, items.length)
  )

  const itemsSignature = items.map((i) => i.id).join('\0')

  useEffect(() => {
    setVisibleCount(Math.min(resolvedInitial, items.length))
  }, [itemsSignature, resolvedInitial, items.length])

  if (pagedGrid) {
    const cappedVisible = Math.min(visibleCount, items.length)
    const visibleItems = items.slice(0, cappedVisible)
    const hasMoreInline = cappedVisible < items.length
    const exploreHref = sectionSlug ? `/explore/${sectionSlug}` : undefined

    return (
      <section
        className="content-section content-section--paged"
        aria-labelledby={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className="content-section-header">
          <h2 id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`} className="content-section-heading">
            {title}
          </h2>
          {exploreHref && (
            <Link href={exploreHref} className="content-section-view-all">
              View all
              <ChevronRight size={16} aria-hidden />
            </Link>
          )}
        </div>
        <div
          className={`content-section-grid ${
            gridLayout === 'single-column'
              ? 'content-section-grid-single-column'
              : gridLayout === 'responsive-trending'
                ? 'content-section-grid-responsive-trending'
                : ''
          }`}
        >
          {visibleItems.map((item) => (
            <ItemCard key={item.id} {...item} />
          ))}
        </div>
        {(hasMoreInline || exploreHref) && (
          <div className="content-section-load-more-wrap">
            {hasMoreInline ? (
              <button
                type="button"
                className="content-section-load-more-button"
                onClick={() =>
                  setVisibleCount((n) => Math.min(n + resolvedStep, items.length))
                }
              >
                <span>View more</span>
                <ChevronDown size={18} aria-hidden className="content-section-load-more-icon" />
              </button>
            ) : exploreHref ? (
              <Link
                href={exploreHref}
                className="content-section-load-more-button content-section-load-more-as-link"
              >
                <span>View more</span>
                <ChevronRight size={18} aria-hidden className="content-section-load-more-icon" />
              </Link>
            ) : null}
          </div>
        )}
      </section>
    )
  }

  if (showAsGrid) {
    return (
      <section className="content-section" aria-labelledby={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        <h2 id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`} className="content-section-title">
          {title}
        </h2>
        <div
          className={`content-section-grid ${
            gridLayout === 'single-column'
              ? 'content-section-grid-single-column'
              : gridLayout === 'responsive-trending'
                ? 'content-section-grid-responsive-trending'
                : ''
          }`}
        >
          {items.map((item) => (
            <ItemCard key={item.id} {...item} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <Carousel
      title={title}
      viewMoreHref={sectionSlug ? `/explore/${sectionSlug}` : undefined}
    >
      {items.map((item) => (
        <ItemCard key={item.id} {...item} />
      ))}
    </Carousel>
  )
}
