'use client'

import { useState, useEffect } from 'react'
import { Search, ArrowRight, Clock, User } from 'lucide-react'
import Link from 'next/link'
import { subscribeNewsletter, type ArticleRow } from '@/lib/supabaseClient'
import '../styles/Blog.css'

interface Article {
  id: string
  slug: string
  title: string
  description: string
  category: 'Tutorials' | 'Guides' | 'Trends'
  author: string
  date: string
  readTime: string
  tags: string[]
  image?: string
  featured?: boolean
}

function estimateReadTime(content: string): string {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.ceil(words / 200))
  return `${minutes} min read`
}

function formatArticleDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function mapRowToArticle(row: ArticleRow, index: number): Article {
  const description = row.summary ?? row.content.slice(0, 160) + (row.content.length > 160 ? '…' : '')
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    description,
    category: 'Tutorials',
    author: row.user_account?.username ?? 'Unknown',
    date: formatArticleDate(row.published_at),
    readTime: estimateReadTime(row.content),
    tags: [],
    featured: index === 0,
  }
}

const PAGE_SIZE = 9

interface BlogProps {
  isLoggedIn?: boolean
  userName?: string
  userAvatar?: string
  /** When true, show search bar and use server-side search. */
  searchEnabled?: boolean
}

export default function Blog({ isLoggedIn = false, userName, userAvatar, searchEnabled = false }: BlogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [articles, setArticles] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [newsletterMessage, setNewsletterMessage] = useState('')

  const handleBlogNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newsletterEmail.trim()) return
    setNewsletterStatus('loading')
    setNewsletterMessage('')
    const { ok, error } = await subscribeNewsletter(newsletterEmail)
    if (ok) {
      setNewsletterStatus('success')
      setNewsletterMessage('Thanks! You’re subscribed.')
      setNewsletterEmail('')
    } else {
      setNewsletterStatus('error')
      setNewsletterMessage(error ?? 'Something went wrong. Try again.')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(searchInput)
    setPage(1)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const offset = (page - 1) * PAGE_SIZE
    const searchTerm = searchEnabled ? searchQuery.trim() || undefined : undefined
    const q = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
    if (searchTerm) q.set('search', searchTerm)
    fetch(`/api/blog/articles?${q.toString()}`, { credentials: 'include' })
      .then((res) => res.ok ? res.json() : { articles: [], total: 0 })
      .then(({ articles: rows, total: t }: { articles: ArticleRow[]; total: number }) => {
        if (!cancelled) {
          setArticles((rows ?? []).map((row, i) => mapRowToArticle(row, offset + i)))
          setTotal(t ?? 0)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setArticles([])
          setTotal(0)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [page, searchEnabled, searchQuery])

  const featuredArticle = articles.find(article => article.featured)
  const regularArticles = articles.filter(article => !article.featured)

  const filteredArticles = regularArticles.filter(article => {
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory
    const matchesSearch = searchQuery === '' || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const categoryCounts = {
    all: articles.length,
    Tutorials: articles.filter(a => a.category === 'Tutorials').length,
    Guides: articles.filter(a => a.category === 'Guides').length,
    Trends: articles.filter(a => a.category === 'Trends').length,
  }

  const popularTags = ['3D Design', '3D Printing', 'Digital Art', 'Tutorials', 'Patterns', 'Innovation', 'Maker Space', 'Beginners']
  
  const recentArticles = articles
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4)

  return (
    <div className="blog-page">
      {/* Header Section */}
      <header className="blog-header">
        <div className="blog-header-container">
          <h1 className="blog-header-title">Blog</h1>
          <p className="blog-header-subtitle">
            Discover tutorials, guides, and insights from our creative community.
          </p>
        </div>
      </header>

      <div className="blog-container">
        <div className="blog-content">
          {loading && (
            <p className="blog-loading" aria-live="polite">Loading articles…</p>
          )}
          {/* Featured Article */}
          {!loading && featuredArticle && (
            <article className="blog-featured">
              <div className="blog-featured-badge">Featured Article</div>
              <div className="blog-featured-content">
                <div className="blog-featured-image">
                  <div className="blog-featured-image-placeholder">
                    {/* Placeholder for featured image */}
                  </div>
                </div>
                <div className="blog-featured-info">
                  <div className="blog-featured-category">{featuredArticle.category}</div>
                  <h2 className="blog-featured-title">{featuredArticle.title}</h2>
                  <p className="blog-featured-description">{featuredArticle.description}</p>
                  <div className="blog-featured-meta">
                    <span className="blog-meta-item">
                      <User size={16} />
                      {featuredArticle.author}
                    </span>
                    <span className="blog-meta-item">
                      {featuredArticle.date}
                    </span>
                    <span className="blog-meta-item">
                      <Clock size={16} />
                      {featuredArticle.readTime}
                    </span>
                  </div>
                  <div className="blog-featured-tags">
                    {featuredArticle.tags.map((tag, index) => (
                      <span key={index} className="blog-tag">{tag}</span>
                    ))}
                  </div>
                  <Link href={`/blog/${featuredArticle.slug}`} className="blog-featured-button">
                    Read Full Article
                    <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            </article>
          )}

          {/* Filters */}
          {!loading && (
          <div className="blog-filters">
            <button
              className={`blog-filter-button ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All Posts ({categoryCounts.all})
            </button>
            <button
              className={`blog-filter-button ${selectedCategory === 'Tutorials' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('Tutorials')}
            >
              Tutorials ({categoryCounts.Tutorials})
            </button>
            <button
              className={`blog-filter-button ${selectedCategory === 'Guides' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('Guides')}
            >
              Guides ({categoryCounts.Guides})
            </button>
            <button
              className={`blog-filter-button ${selectedCategory === 'Trends' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('Trends')}
            >
              Trends ({categoryCounts.Trends})
            </button>
          </div>
          )}

          {/* Search Bar (only when ARTICLE_SEARCH_ENABLED) */}
          {searchEnabled && (
            <form className="blog-search" onSubmit={handleSearchSubmit} role="search">
              <div className="blog-search-wrapper">
                <Search size={20} className="blog-search-icon" />
                <input
                  type="search"
                  placeholder="Search articles..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="blog-search-input"
                  aria-label="Search articles"
                />
                <button type="submit" className="blog-search-submit">Search</button>
              </div>
            </form>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <nav className="blog-pagination" aria-label="Blog pagination">
              <button
                type="button"
                className="blog-pagination-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
              <span className="blog-pagination-info">
                Page {page} of {totalPages} ({total} articles)
              </span>
              <button
                type="button"
                className="blog-pagination-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </nav>
          )}

          {/* Articles Grid */}
          <div className="blog-articles-grid">
            {!loading && filteredArticles.map((article) => (
              <article key={article.id} className="blog-article-card">
                <Link href={`/blog/${article.slug}`} className="blog-article-card-link">
                  <div className="blog-article-category">{article.category}</div>
                  <div className="blog-article-image">
                    <div className="blog-article-image-placeholder">
                      {/* Placeholder for article image */}
                    </div>
                  </div>
                  <div className="blog-article-content">
                    <h3 className="blog-article-title">{article.title}</h3>
                    <p className="blog-article-description">{article.description}</p>
                    <div className="blog-article-meta">
                      <span className="blog-meta-item">
                        <User size={14} />
                        {article.author}
                      </span>
                      <span className="blog-meta-item">{article.date}</span>
                      <span className="blog-meta-item">
                        <Clock size={14} />
                        {article.readTime}
                      </span>
                    </div>
                    <div className="blog-article-tags">
                      {article.tags.map((tag, index) => (
                        <span key={index} className="blog-tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="blog-sidebar">
          {/* Popular Tags */}
          <section className="blog-sidebar-section">
            <h3 className="blog-sidebar-title">Popular Tags</h3>
            <div className="blog-popular-tags">
              {popularTags.map((tag, index) => (
                <button key={index} className="blog-popular-tag">{tag}</button>
              ))}
            </div>
          </section>

          {/* Recent Articles */}
          <section className="blog-sidebar-section">
            <h3 className="blog-sidebar-title">Recent Articles</h3>
            <ul className="blog-recent-articles">
              {recentArticles.map((article) => (
                <li key={article.id} className="blog-recent-item">
                  <Link href={`/blog/${article.slug}`} className="blog-recent-link">
                    {article.title}
                  </Link>
                  <span className="blog-recent-date">{article.date}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Newsletter Signup */}
          <section className="blog-sidebar-section">
            <h3 className="blog-sidebar-title">Stay Updated</h3>
            <p className="blog-newsletter-description">
              Get the latest articles and tutorials delivered to your inbox.
            </p>
            <form onSubmit={handleBlogNewsletterSubmit} className="blog-newsletter-form">
              <input
                type="email"
                placeholder="Your email"
                className="blog-newsletter-input"
                value={newsletterEmail}
                onChange={(e) => { setNewsletterEmail(e.target.value); setNewsletterStatus('idle') }}
                required
                disabled={newsletterStatus === 'loading'}
              />
              <button type="submit" className="blog-newsletter-button" disabled={newsletterStatus === 'loading'}>
                Subscribe
              </button>
            </form>
            {newsletterMessage && (
              <p className={`blog-newsletter-message blog-newsletter-message--${newsletterStatus}`} role="status">
                {newsletterMessage}
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
