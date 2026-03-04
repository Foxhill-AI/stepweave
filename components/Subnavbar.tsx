'use client'

import { Suspense, useState, useEffect } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import ExploreDropdown from './ExploreDropdown'
import AdvancedSearchModal, { type AdvancedSearchParams } from './AdvancedSearchModal'
import { getCategories, type CategoryRow } from '@/lib/supabaseClient'
import '../styles/Subnavbar.css'

function SubnavbarInner() {
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showExploreDropdown, setShowExploreDropdown] = useState(false)
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const selectedCategory = searchParams.get('category') ?? 'all'

  useEffect(() => {
    getCategories().then(setCategories)
  }, [])

  useEffect(() => {
    if (pathname === '/search') {
      const qParam = searchParams.get('q')
      setSearchQuery(qParam ?? '')
    }
  }, [pathname, searchParams])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    const term = searchQuery.trim()
    if (term) params.set('q', term)
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory)
    router.push(`/search?${params.toString()}`)
  }

  const handleAdvancedSearch = (params: AdvancedSearchParams) => {
    const urlParams = new URLSearchParams()
    const term = params.hasWords.trim()
    if (term) urlParams.set('q', term)
    if (params.category && params.category !== 'all') urlParams.set('category', params.category)
    if (params.creator.trim()) urlParams.set('creator', params.creator.trim())
    if (params.dateCreated && params.dateCreated !== 'any') urlParams.set('date', params.dateCreated)
    if (params.exactMatch.trim()) urlParams.set('exact', params.exactMatch.trim())
    if (params.mustContain.trim()) urlParams.set('must', params.mustContain.trim())
    if (params.exclude.trim()) urlParams.set('exclude', params.exclude.trim())
    setSearchQuery(params.hasWords)
    router.push(`/search?${urlParams.toString()}`)
    setShowFilters(false)
  }

  const advancedSearchInitialParams =
    pathname === '/search'
      ? {
          hasWords: searchParams.get('q') ?? '',
          category: searchParams.get('category') ?? 'all',
          creator: searchParams.get('creator') ?? '',
          dateCreated: (searchParams.get('date') ?? 'any') as AdvancedSearchParams['dateCreated'],
          exactMatch: searchParams.get('exact') ?? '',
          mustContain: searchParams.get('must') ?? '',
          exclude: searchParams.get('exclude') ?? '',
        }
      : undefined

  return (
    <nav className="subnavbar" role="navigation" aria-label="Secondary navigation">
      <div className="subnavbar-container">
        <div className="subnavbar-links">
          <div className="subnavbar-link-wrapper">
            <button
              className="subnavbar-link"
              onClick={(e) => {
                e.preventDefault()
                setShowExploreDropdown(!showExploreDropdown)
              }}
              aria-expanded={showExploreDropdown}
              aria-haspopup="true"
            >
              Explore
            </button>
            {showExploreDropdown && (
              <ExploreDropdown
                isOpen={showExploreDropdown}
                onClose={() => setShowExploreDropdown(false)}
                categories={categories}
              />
            )}
          </div>
        </div>

        <form className="subnavbar-search" onSubmit={handleSearch}>
          <div className="search-wrapper">
            <Search className="search-icon" size={20} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search designs, products, creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              aria-label="Search content"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="search-clear"
                aria-label="Clear search"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="filter-toggle-inline"
              onClick={(e) => {
                e.preventDefault()
                setShowFilters(!showFilters)
              }}
              aria-label="Toggle filters"
              aria-expanded={showFilters}
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
              {showFilters && <span className="filter-badge">•</span>}
            </button>
          </div>
        </form>
      </div>

      <AdvancedSearchModal
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        initialParams={advancedSearchInitialParams}
        categories={categories}
        onSearch={handleAdvancedSearch}
      />
    </nav>
  )
}

export default function Subnavbar() {
  return (
    <Suspense fallback={<nav className="subnavbar" role="navigation" aria-label="Secondary navigation"><div className="subnavbar-container" /></nav>}>
      <SubnavbarInner />
    </Suspense>
  )
}
