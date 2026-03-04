'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronRight, ChevronLeft, X } from 'lucide-react'
import Link from 'next/link'
import type { CategoryRow } from '@/lib/supabaseClient'
import '../styles/ExploreDropdown.css'

interface ExploreDropdownProps {
  isOpen: boolean
  onClose: () => void
  /** Categories from DB (Subnavbar fetches and passes). If empty, fallback list is used. */
  categories?: CategoryRow[]
}

type ViewType = 'main' | 'categories' | 'trending-searches' | 'trending-tags'

const FALLBACK_CATEGORIES = [
  '3D Printer Parts & Accessories',
  'Art & Decor',
  'Costumes & Cosplay',
  'Educational & Scientific',
  'Fashion & Jewelry',
  'Functional Prints',
  'Health & Fitness',
  'Hobby & DIY',
  'Home & Garden',
  'Miniatures & Tabletop',
  'Seasonal',
  'Tools & Organizers',
  'Toys & Games',
]

export default function ExploreDropdown({ isOpen, onClose, categories: categoriesFromDb }: ExploreDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [currentView, setCurrentView] = useState<ViewType>('main')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 767)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (currentView !== 'main' && isMobile) {
          setCurrentView('main')
        } else {
          onClose()
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose, currentView, isMobile])

  useEffect(() => {
    if (isOpen) {
      setCurrentView('main')
    }
  }, [isOpen])

  if (!isOpen) return null

  const browseLinks = [
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/for-you', label: 'For You' },
    { href: '/trending', label: 'Trending' },
    { href: '/popular', label: 'Popular' },
    { href: '/paid', label: 'Paid' },
    { href: '/makes', label: 'Makes' },
    { href: '/videos', label: 'Videos' },
    { href: '/new-uploads', label: 'New Uploads' },
    { href: '/downloads', label: 'Downloads' },
    { href: '/leagues', label: 'Leagues' },
    { href: '/hall-of-fame', label: 'Hall of Fame' },
  ]

  const trendingSearches = [
    'gridfinity',
    'free',
    'multiboard',
    'fidget',
    'lamp',
    'dragon',
    'vase',
    'valentines',
    'pokemon',
    'clicker',
    'star wars',
    'desk organizer',
    'dice tower',
    'headphone stand',
  ]

  const trendingTags = [
    'Arts & entertainment',
    'Automotive tire',
    'Business & industrial',
    'Business services',
    'Christmas',
    'Computer hardware',
    'Computer peripherals',
    'Computers & electronics',
    'Decor',
    'Games',
    'Halloween',
    'Hobbies & leisure',
    'Holder',
    'Home & garden',
    'Office supplies',
    'Organizer',
    'Rectangle',
    'Storage',
    'Table',
    'Toy',
  ]

  const handleBackClick = () => {
    setCurrentView('main')
  }

  // Desktop: Original 3-column layout
  const renderDesktopView = () => (
    <>
      {/* Left Column - Browse */}
      <div className="explore-column explore-column-browse">
        <h3 className="explore-column-title">Browse</h3>
        <ul className="explore-list">
          {browseLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="explore-link"
                onClick={onClose}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Middle Column - Categories */}
      <div className="explore-column">
        <h3 className="explore-column-title">Categories</h3>
        <ul className="explore-list">
          {categoriesFromDb?.length
            ? categoriesFromDb.map((c: CategoryRow) => (
                <li key={c.id}>
                  <Link
                    href={`/marketplace?category=${encodeURIComponent(c.slug)}`}
                    className="explore-link explore-link-category"
                    onClick={onClose}
                  >
                    {c.name}
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))
            : FALLBACK_CATEGORIES.map((category: string, index: number) => (
                <li key={index}>
                  <Link
                    href={`/category/${category.toLowerCase().replace(/\s+/g, '-')}`}
                    className="explore-link explore-link-category"
                    onClick={onClose}
                  >
                    {category}
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
        </ul>
      </div>

      {/* Right Column - Trending */}
      <div className="explore-column explore-column-trending">
        <div className="explore-trending-layout">
          <div className="explore-subsection">
            <h3 className="explore-column-title">Trending searches</h3>
            <ul className="explore-list explore-list-compact">
              {trendingSearches.map((search, index) => (
                <li key={index}>
                  <Link
                    href={`/search?q=${encodeURIComponent(search)}`}
                    className="explore-link"
                    onClick={onClose}
                  >
                    {search}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="explore-subsection">
            <h3 className="explore-column-title">Trending tags</h3>
            <div className="explore-tags">
              {trendingTags.map((tag, index) => (
                <Link
                  key={index}
                  href={`/tag/${tag.toLowerCase().replace(/\s+/g, '-')}`}
                  className="explore-tag"
                  onClick={onClose}
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )

  // Mobile: Navigation by levels
  const renderMobileMainView = () => (
    <>
      {/* Browse Section - Always Visible */}
      <div className="explore-section explore-section-browse">
        <h3 className="explore-section-title">Browse</h3>
        <ul className="explore-list">
          {browseLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="explore-link"
                onClick={onClose}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Explore Section */}
      <div className="explore-section">
        <h3 className="explore-section-title">Explore</h3>
        
        <button
          className="explore-section-item"
          onClick={() => setCurrentView('categories')}
        >
          <span>Categories</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>

        <button
          className="explore-section-item"
          onClick={() => setCurrentView('trending-searches')}
        >
          <span>Trending searches</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>

        <button
          className="explore-section-item"
          onClick={() => setCurrentView('trending-tags')}
        >
          <span>Trending tags</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </>
  )

  const renderCategoriesView = () => (
    <div className="explore-subview">
      <button className="explore-back-button" onClick={handleBackClick}>
        <ChevronLeft size={18} aria-hidden="true" />
        <span>Categories</span>
      </button>
      <ul className="explore-list">
        {categoriesFromDb?.length
          ? categoriesFromDb.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/marketplace?category=${encodeURIComponent(c.slug)}`}
                  className="explore-link explore-link-category"
                  onClick={onClose}
                >
                  {c.name}
                  <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </li>
            ))
          : FALLBACK_CATEGORIES.map((category: string, index: number) => (
              <li key={index}>
                <Link
                  href={`/category/${category.toLowerCase().replace(/\s+/g, '-')}`}
                  className="explore-link explore-link-category"
                  onClick={onClose}
                >
                  {category}
                  <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </li>
            ))}
      </ul>
    </div>
  )

  const renderTrendingSearchesView = () => (
    <div className="explore-subview">
      <button className="explore-back-button" onClick={handleBackClick}>
        <ChevronLeft size={18} aria-hidden="true" />
        <span>Trending searches</span>
      </button>
      <ul className="explore-list explore-list-compact">
        {trendingSearches.map((search, index) => (
          <li key={index}>
            <Link
              href={`/search?q=${encodeURIComponent(search)}`}
              className="explore-link"
              onClick={onClose}
            >
              {search}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )

  const renderTrendingTagsView = () => (
    <div className="explore-subview">
      <button className="explore-back-button" onClick={handleBackClick}>
        <ChevronLeft size={18} aria-hidden="true" />
        <span>Trending tags</span>
      </button>
      <div className="explore-tags">
        {trendingTags.map((tag, index) => (
          <Link
            key={index}
            href={`/tag/${tag.toLowerCase().replace(/\s+/g, '-')}`}
            className="explore-tag"
            onClick={onClose}
          >
            {tag}
          </Link>
        ))}
      </div>
    </div>
  )

  return (
    <>
      <div className="explore-dropdown-overlay" onClick={onClose} />
      <div
        ref={dropdownRef}
        className="explore-dropdown"
        onClick={(e) => e.stopPropagation()}
        role="menu"
        aria-label="Explore menu"
      >
        <button
          className="explore-close-button"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X size={20} aria-hidden="true" />
        </button>
        <div className="explore-dropdown-content">
          {/* Desktop: 3-column layout */}
          <div className="explore-desktop-view">
            {renderDesktopView()}
          </div>

          {/* Mobile: Navigation by levels */}
          <div className="explore-mobile-view">
            {currentView === 'main' && renderMobileMainView()}
            {currentView === 'categories' && renderCategoriesView()}
            {currentView === 'trending-searches' && renderTrendingSearchesView()}
            {currentView === 'trending-tags' && renderTrendingTagsView()}
          </div>
        </div>
      </div>
    </>
  )
}
