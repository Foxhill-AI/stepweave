'use client'

import { useState, useEffect } from 'react'
import Modal from './ui/Modal'
import '../styles/AdvancedSearchModal.css'

export type DateCreatedOption = 'any' | 'week' | 'month' | 'year'

export interface AdvancedSearchParams {
  hasWords: string
  exactMatch: string
  mustContain: string
  exclude: string
  dateCreated: DateCreatedOption
  creator: string
  category: string
}

const DATE_OPTIONS: { value: DateCreatedOption; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past month' },
  { value: 'year', label: 'Past year' },
]

const emptyParams: AdvancedSearchParams = {
  hasWords: '',
  exactMatch: '',
  mustContain: '',
  exclude: '',
  dateCreated: 'any',
  creator: '',
  category: 'all',
}

interface AdvancedSearchModalProps {
  isOpen: boolean
  onClose: () => void
  initialParams?: Partial<AdvancedSearchParams>
  categories: { id: number; name: string; slug: string }[]
  onSearch: (params: AdvancedSearchParams) => void
}

export default function AdvancedSearchModal({
  isOpen,
  onClose,
  initialParams,
  categories,
  onSearch,
}: AdvancedSearchModalProps) {
  const [params, setParams] = useState<AdvancedSearchParams>({ ...emptyParams, ...initialParams })

  useEffect(() => {
    if (isOpen) {
      setParams({ ...emptyParams, ...initialParams })
    }
  }, [isOpen, initialParams?.hasWords, initialParams?.exactMatch, initialParams?.mustContain, initialParams?.exclude, initialParams?.dateCreated, initialParams?.creator, initialParams?.category])

  const handleClear = () => {
    setParams({ ...emptyParams })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(params)
    onClose()
  }

  const update = <K extends keyof AdvancedSearchParams>(key: K, value: AdvancedSearchParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Advanced Search" className="advanced-search-modal">
      <form onSubmit={handleSubmit} className="advanced-search-form">
        <section className="advanced-search-section" aria-labelledby="phrase-heading">
          <h3 id="phrase-heading" className="advanced-search-heading">
            Search by word or phrase
          </h3>
          <div className="advanced-search-fields">
            <div className="advanced-search-field">
              <label htmlFor="has-words" className="advanced-search-label">
                Has these words
              </label>
              <input
                id="has-words"
                type="text"
                className="advanced-search-input"
                placeholder="Words to search for"
                value={params.hasWords}
                onChange={(e) => update('hasWords', e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="advanced-search-field">
              <label htmlFor="exact-match" className="advanced-search-label">
                Exact match
              </label>
              <input
                id="exact-match"
                type="text"
                className="advanced-search-input"
                placeholder="Word or phrase to match exactly"
                value={params.exactMatch}
                onChange={(e) => update('exactMatch', e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="advanced-search-field">
              <label htmlFor="must-contain" className="advanced-search-label">
                Must contain
              </label>
              <input
                id="must-contain"
                type="text"
                className="advanced-search-input"
                placeholder="Words to require"
                value={params.mustContain}
                onChange={(e) => update('mustContain', e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="advanced-search-field">
              <label htmlFor="exclude" className="advanced-search-label">
                Does not contain
              </label>
              <input
                id="exclude"
                type="text"
                className="advanced-search-input"
                placeholder="Words to exclude"
                value={params.exclude}
                onChange={(e) => update('exclude', e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        </section>

        <section className="advanced-search-section" aria-labelledby="narrow-heading">
          <h3 id="narrow-heading" className="advanced-search-heading">
            Narrow results by
          </h3>
          <div className="advanced-search-fields">
            <div className="advanced-search-field">
              <label htmlFor="date-created" className="advanced-search-label">
                Date created
              </label>
              <select
                id="date-created"
                className="advanced-search-select"
                value={params.dateCreated}
                onChange={(e) => update('dateCreated', e.target.value as DateCreatedOption)}
                aria-label="Date created"
              >
                {DATE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="advanced-search-field">
              <label htmlFor="creator" className="advanced-search-label">
                Specific creator
              </label>
              <input
                id="creator"
                type="text"
                className="advanced-search-input"
                placeholder="Creator's user name"
                value={params.creator}
                onChange={(e) => update('creator', e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="advanced-search-field">
              <label htmlFor="category-adv" className="advanced-search-label">
                Category
              </label>
              <select
                id="category-adv"
                className="advanced-search-select"
                value={params.category}
                onChange={(e) => update('category', e.target.value)}
                aria-label="Category"
              >
                <option value="all">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <div className="advanced-search-actions">
          <a href="/help/search" className="advanced-search-learn">
            Learn more about search
          </a>
          <div className="advanced-search-buttons">
            <button
              type="button"
              className="advanced-search-btn advanced-search-btn-clear"
              onClick={handleClear}
            >
              Clear
            </button>
            <button type="submit" className="advanced-search-btn advanced-search-btn-search">
              Search
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
