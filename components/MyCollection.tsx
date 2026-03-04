'use client'

import Link from 'next/link'
import ItemCard from './ItemCard'
import { Bookmark, ShoppingCart } from 'lucide-react'
import '../styles/MyCollection.css'

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

interface MyCollectionProps {
  /** Saved items from Supabase; undefined = loading, [] = empty */
  items?: Item[] | undefined
  /** Called when user unsaves an item (remove from collection). */
  onUnsave?: (productId: number) => void
}

export default function MyCollection({ items, onUnsave }: MyCollectionProps) {
  const savedItems = items ?? []
  const isLoading = items === undefined

  return (
    <div className="my-collection">
      <div className="collection-container">
        <header className="collection-header">
          <div className="collection-header-content">
            <h1 className="collection-title">My Collection</h1>
            {!isLoading && (
              <p className="collection-subtitle">
                {savedItems.length} {savedItems.length === 1 ? 'item' : 'items'} saved
              </p>
            )}
          </div>
        </header>

        {isLoading ? (
          <div className="collection-loading">
            <p>Loading your collection…</p>
          </div>
        ) : savedItems.length > 0 ? (
          <div className="collection-masonry">
            {savedItems.map((item) => (
              <div key={item.id} className="collection-item-wrapper">
                <ItemCard {...item} />
                <div className="collection-item-actions">
                  {onUnsave && (
                    <button
                      type="button"
                      className="collection-item-unsave"
                      onClick={() => onUnsave(Number(item.id))}
                      aria-label={`Remove ${item.title} from collection`}
                    >
                      <Bookmark size={16} />
                      Unsave
                    </button>
                  )}
                  <Link
                    href={`/item/${item.id}`}
                    className="collection-item-add-to-cart"
                    aria-label={`Add ${item.title} to cart`}
                  >
                    <ShoppingCart size={16} />
                    Add to cart
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="collection-empty" role="status">
            <div className="collection-empty-content">
              <div className="collection-empty-icon">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                </svg>
              </div>
              <h2 className="collection-empty-title">No items in your collection yet</h2>
              <p className="collection-empty-description">
                Save products from their pages to see them here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
