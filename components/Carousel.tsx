'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import '../styles/Carousel.css'

interface CarouselProps {
  children: React.ReactNode
  title?: string
  autoScroll?: boolean
  scrollInterval?: number
  /** When set, renders a "View more" card as the last item that links to this href */
  viewMoreHref?: string
}

export default function Carousel({
  children,
  title,
  autoScroll = false,
  scrollInterval = 5000,
  viewMoreHref,
}: CarouselProps) {
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const checkScrollButtons = () => {
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const { scrollLeft, scrollWidth, clientWidth } = container
    
    // Add a small threshold to account for rounding and ensure buttons show correctly
    const threshold = 5
    const canScrollLeft = scrollLeft > threshold
    const canScrollRight = scrollLeft < scrollWidth - clientWidth - threshold
    
    setShowLeftArrow(canScrollLeft)
    setShowRightArrow(canScrollRight)
  }

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    // Initial check with delays to ensure content is loaded and measured
    const initialCheck1 = setTimeout(() => {
      checkScrollButtons()
    }, 100)
    
    const initialCheck2 = setTimeout(() => {
      checkScrollButtons()
    }, 500)
    
    // Also check after a longer delay to catch any late-loading content
    const initialCheck3 = setTimeout(() => {
      checkScrollButtons()
    }, 1500)

    container.addEventListener('scroll', checkScrollButtons)

    // Auto-scroll functionality
    let intervalId: NodeJS.Timeout | null = null
    if (autoScroll) {
      intervalId = setInterval(() => {
        if (container && showRightArrow) {
          const scrollAmount = container.clientWidth * 0.8
          container.scrollBy({ left: scrollAmount, behavior: 'smooth' })
        } else if (container) {
          // Reset to beginning
          container.scrollTo({ left: 0, behavior: 'smooth' })
        }
        setTimeout(checkScrollButtons, 500)
      }, scrollInterval)
    }

    // Resize observer for responsive behavior
    const resizeObserver = new ResizeObserver(() => {
      // Add a small delay to ensure layout is stable
      setTimeout(checkScrollButtons, 50)
    })
    resizeObserver.observe(container)

    // Also check when images/content load
    const checkOnLoad = () => {
      setTimeout(checkScrollButtons, 100)
    }
    container.addEventListener('load', checkOnLoad, true)

    return () => {
      clearTimeout(initialCheck1)
      clearTimeout(initialCheck2)
      clearTimeout(initialCheck3)
      container.removeEventListener('scroll', checkScrollButtons)
      container.removeEventListener('load', checkOnLoad, true)
      resizeObserver.disconnect()
      if (intervalId) clearInterval(intervalId)
    }
  }, [autoScroll, scrollInterval, showRightArrow])

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const scrollAmount = container.clientWidth * 0.8
    const targetScroll =
      direction === 'left'
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount

    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth',
    })
  }

  return (
    <section className="carousel-section" aria-label={title || 'Carousel'}>
      {title && title !== 'Featured Items' && (
        <div className="carousel-header">
          <h2 className="carousel-title">{title}</h2>
          <Link
            href={viewMoreHref ?? `/${title.toLowerCase().replace(/\s+/g, '-')}`}
            className="carousel-view-all"
          >
            View All
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
      <div className="carousel-wrapper">
        {showLeftArrow && (
          <button
            className="carousel-button carousel-button-left"
            onClick={() => scroll('left')}
            aria-label="Scroll left"
          >
            <ChevronLeft size={24} aria-hidden="true" />
          </button>
        )}
        <div
          ref={scrollContainerRef}
          className="carousel-container"
          role="region"
          aria-label={title || 'Scrollable content'}
          tabIndex={0}
        >
          {children}
          {viewMoreHref && (
            <Link
              href={viewMoreHref}
              className="carousel-view-more-card"
              aria-label={`View more ${title || 'items'}`}
            >
              <span className="carousel-view-more-text">View more</span>
              <ChevronRight size={20} aria-hidden="true" />
            </Link>
          )}
        </div>
        {showRightArrow && (
          <button
            className="carousel-button carousel-button-right"
            onClick={() => scroll('right')}
            aria-label="Scroll right"
          >
            <ChevronRight size={24} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  )
}
