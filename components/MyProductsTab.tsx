'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Filter, Edit, Copy, Archive, Trash2, Eye, Plus } from 'lucide-react'
import ItemCard from './ItemCard'
import { useAuth } from '@/components/AuthProvider'
import {
  getProductsByUserAccountId,
  updateProduct,
  deleteProduct,
  productHasOrders,
  type ProductListingRow,
} from '@/lib/supabaseClient'
import '../styles/MyProductsTab.css'

interface Product {
  id: string
  name: string
  price?: string
  status: 'draft' | 'active' | 'archived'
  created_at: string
  category?: string
  image?: string
  views?: number
  likes?: number
  downloads?: number
  author?: string
  rating?: number
  badge?: string
}

function mapRowToProduct(row: ProductListingRow): Product {
  const firstCategory = row.product_category?.[0]?.category?.name
  const designData = row.design_data as { imageUrl?: string } | null
  return {
    id: String(row.id),
    name: row.name,
    price: `$${Number(row.price).toFixed(2)}`,
    status: row.status as 'draft' | 'active' | 'archived',
    created_at: row.created_at,
    category: firstCategory ?? undefined,
    image: designData?.imageUrl,
    views: 0,
    likes: 0,
    downloads: 0,
    author: 'You',
    badge: row.status === 'active' ? 'Published' : row.status === 'draft' ? 'Draft' : 'Archived',
  }
}

export default function MyProductsTab() {
  const router = useRouter()
  const { userAccount } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    if (!userAccount?.id) {
      setProducts([])
      setLoading(false)
      return
    }
    setLoading(true)
    const rows = await getProductsByUserAccountId(userAccount.id)
    setProducts(rows.map(mapRowToProduct))
    setLoading(false)
  }, [userAccount?.id])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[]

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      !searchQuery || product.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter
    return matchesSearch && matchesStatus && matchesCategory
  })

  const handleAction = async (action: string, productId: string) => {
    setActionError(null)
    const id = Number(productId)
    if (Number.isNaN(id)) return

    switch (action) {
      case 'edit':
        router.push(`/design-tool/${productId}`)
        break
      case 'duplicate':
        // TODO: clone product + variants
        break
      case 'archive': {
        const message =
          'Archive this product? It will be hidden from the marketplace but will remain in your dashboard as archived.'
        if (typeof window !== 'undefined' && !window.confirm(message)) break
        const ok = await updateProduct(id, { status: 'archived' })
        if (ok) await fetchProducts()
        else setActionError('Failed to archive product.')
        break
      }
      case 'publish': {
        const isArchived = products.find((p) => p.id === productId)?.status === 'archived'
        const message = isArchived
          ? 'Publish this product again? It will be visible in the marketplace.'
          : 'Publish this product? It will be visible in the marketplace.'
        if (typeof window !== 'undefined' && !window.confirm(message)) break
        const ok = await updateProduct(id, { status: 'active' })
        if (ok) await fetchProducts()
        else setActionError('Failed to publish product.')
        break
      }
      case 'delete': {
        const hasOrders = await productHasOrders(id)
        if (hasOrders) {
          setActionError(
            'This product has orders and cannot be permanently deleted. You can archive it to hide it from the marketplace.'
          )
          break
        }
        const message =
          'Permanently delete this product? This cannot be undone. The product will be removed from your dashboard.'
        if (typeof window !== 'undefined' && !window.confirm(message)) break
        const ok = await deleteProduct(id)
        if (ok) await fetchProducts()
        else setActionError('Failed to delete product.')
        break
      }
      default:
        break
    }
  }

  return (
    <div className="my-products-tab">
      <div className="my-products-header">
        <div className="my-products-search">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="my-products-search-input"
          />
        </div>
        <button
          className="my-products-filter-toggle"
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
        >
          <Filter size={20} />
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="my-products-filters">
          <div className="my-products-filter-group">
            <label htmlFor="status-filter">Status</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="my-products-filter-select"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="my-products-filter-group">
            <label htmlFor="category-filter">Category</label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="my-products-filter-select"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="my-products-stats">
        <span className="my-products-count">
          {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
        </span>
        <Link
          href="/design-tool"
          className="my-products-create-btn"
          aria-label="Create new product"
        >
          <Plus size={18} aria-hidden />
          Create product
        </Link>
      </div>

      {actionError && (
        <p className="my-products-error" role="alert">
          {actionError}
        </p>
      )}

      {loading ? (
        <p className="my-products-loading" aria-live="polite">Loading your products…</p>
      ) : filteredProducts.length > 0 ? (
        <div className="my-products-grid">
          {filteredProducts.map((product) => (
            <div key={product.id} className="my-products-item-wrapper">
              <ItemCard
                id={product.id}
                title={product.name}
                category={product.category || 'Uncategorized'}
                image={product.image}
                views={product.views}
                likes={product.likes}
                downloads={product.downloads}
                author={product.author}
                price={product.price}
                rating={product.rating}
                badge={product.badge}
              />
              <div className="my-products-actions">
                <button
                  className="my-products-action-btn"
                  onClick={() => handleAction('edit', product.id)}
                  aria-label="Edit product"
                >
                  <Edit size={16} />
                </button>
                <button
                  className="my-products-action-btn"
                  onClick={() => handleAction('duplicate', product.id)}
                  aria-label="Duplicate product"
                >
                  <Copy size={16} />
                </button>
                {product.status !== 'archived' && (
                  <button
                    className="my-products-action-btn"
                    onClick={() => handleAction('archive', product.id)}
                    aria-label="Archive product"
                  >
                    <Archive size={16} />
                  </button>
                )}
                {(product.status === 'draft' || product.status === 'archived') && (
                  <button
                    className="my-products-action-btn my-products-action-btn-publish"
                    onClick={() => handleAction('publish', product.id)}
                    aria-label={product.status === 'archived' ? 'Publish again' : 'Publish product'}
                    title={product.status === 'archived' ? 'Publish again' : 'Publish product'}
                  >
                    <Eye size={16} />
                  </button>
                )}
                <button
                  className="my-products-action-btn my-products-action-btn-danger"
                  onClick={() => handleAction('delete', product.id)}
                  aria-label="Delete product"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="my-products-empty">
          <p>
            {products.length === 0
              ? 'You have no products yet.'
              : 'No products found matching your filters.'}
          </p>
        </div>
      )}
    </div>
  )
}
