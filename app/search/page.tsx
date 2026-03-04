'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import ItemCard from '@/components/ItemCard'
import { searchProducts } from '@/lib/supabaseClient'
import { productToHomeItem, type HomeItem } from '@/lib/productsForHome'
import { getCategories, type CategoryRow } from '@/lib/supabaseClient'
import { LayoutGrid, LayoutList, Square } from 'lucide-react'
import '../homepage.css'
import '../search-results.css'

type ViewMode = 'grid-sm' | 'grid-lg' | 'list'

function SearchPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const q = searchParams.get('q') ?? ''
  const categoryParam = searchParams.get('category') ?? 'all'
  const creatorParam = searchParams.get('creator') ?? ''
  const dateParam = (searchParams.get('date') ?? 'any') as 'any' | 'week' | 'month' | 'year'
  const exactParam = searchParams.get('exact') ?? ''
  const mustParam = searchParams.get('must') ?? ''
  const excludeParam = searchParams.get('exclude') ?? ''

  const [results, setResults] = useState<HomeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid-lg')
  const [categories, setCategories] = useState<CategoryRow[]>([])

  const fetchResults = useCallback(() => {
    setLoading(true)
    searchProducts(q, {
      categorySlug: categoryParam === 'all' ? undefined : categoryParam,
      creatorUsername: creatorParam || undefined,
      dateCreated: dateParam === 'any' ? undefined : dateParam,
      exactMatch: exactParam || undefined,
      mustContain: mustParam || undefined,
      exclude: excludeParam || undefined,
    })
      .then((rows) => setResults(rows.map(productToHomeItem)))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [q, categoryParam, creatorParam, dateParam, exactParam, mustParam, excludeParam])

  useEffect(() => {
    getCategories().then(setCategories)
  }, [])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  const resultCount = results.length
  const searchLabel = q.trim() ? `"${q.trim()}"` : 'all products'
  const resultsHeading = q.trim()
    ? `Found ${resultCount} result${resultCount !== 1 ? 's' : ''} for ${searchLabel}`
    : resultCount === 0
      ? 'No products found'
      : `Showing ${resultCount} product${resultCount !== 1 ? 's' : ''}`

  return (
    <div className="search-page">
      <Navbar />
      <Subnavbar />

      <main className="search-main container" role="main">
        <header className="search-results-header">
          <h1 className="search-results-title">{resultsHeading}</h1>
          <div className="search-view-toggles" role="group" aria-label="Result view">
            <button
              type="button"
              className={`search-view-btn ${viewMode === 'grid-sm' ? 'search-view-btn-active' : ''}`}
              onClick={() => setViewMode('grid-sm')}
              title="Grid (small)"
              aria-pressed={viewMode === 'grid-sm'}
            >
              <LayoutGrid size={18} aria-hidden="true" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              className={`search-view-btn ${viewMode === 'grid-lg' ? 'search-view-btn-active' : ''}`}
              onClick={() => setViewMode('grid-lg')}
              title="Grid (large)"
              aria-pressed={viewMode === 'grid-lg'}
            >
              <Square size={18} aria-hidden="true" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              className={`search-view-btn ${viewMode === 'list' ? 'search-view-btn-active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List"
              aria-pressed={viewMode === 'list'}
            >
              <LayoutList size={18} aria-hidden="true" />
              <span>List</span>
            </button>
          </div>
        </header>

        <div className="search-filters">
          <label htmlFor="search-category-filter" className="search-filter-label">
            Category
          </label>
          <select
            id="search-category-filter"
            className="search-filter-select"
            value={categoryParam}
            onChange={(e) => {
              const val = e.target.value
              const params = new URLSearchParams(searchParams.toString())
              if (val === 'all') params.delete('category')
              else params.set('category', val)
              router.replace(`/search?${params.toString()}`, { scroll: false })
            }}
            aria-label="Filter by category"
          >
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <p className="search-loading" aria-live="polite">
            Searching…
          </p>
        )}

        {!loading && results.length === 0 && (
          <p className="search-empty" aria-live="polite">
            No products match your search. Try a different keyword or category.
          </p>
        )}

        {!loading && results.length > 0 && (
          <div
            className={`search-results search-results-${viewMode}`}
            data-view={viewMode}
          >
            {results.map((item) => (
              <ItemCard
                key={item.id}
                {...item}
                layout={viewMode === 'list' ? 'list' : 'grid'}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="search-page">
          <Navbar />
          <Subnavbar />
          <main className="search-main container" role="main">
            <p className="search-loading">Loading search…</p>
          </main>
          <Footer />
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  )
}
