'use client'

import Link from 'next/link'
import ContentSection from './ContentSection'
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
  /** Called when user unsaves an item (remove from My Saves). */
  onUnsave?: (productId: number) => void
}

export default function MyCollection({ items, onUnsave }: MyCollectionProps) {
  const savedItems = items ?? []
  const isLoading = items === undefined

  const subtitle =
    !isLoading && savedItems.length > 0
      ? `${savedItems.length} ${savedItems.length === 1 ? 'item' : 'items'} saved`
      : undefined

  return (
    <div className="my-collection">
      <div className="collection-container">
        <div className="container">
        {isLoading ? (
          <div className="collection-loading">
            <p>Loading your saves…</p>
          </div>
        ) : savedItems.length > 0 ? (
          <ContentSection
            title="My Saves"
            subtitle={subtitle}
            items={savedItems}
            pagedGrid
            renderBelowCard={(item) => (
              <div className="collection-item-actions">
                {onUnsave && (
                  <button
                    type="button"
                    className="collection-item-unsave"
                    onClick={() => onUnsave(Number(item.id))}
                    aria-label={`Remove ${item.title} from My Saves`}
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
            )}
          />
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
              <h2 className="collection-empty-title">No saved items yet</h2>
              <p className="collection-empty-description">
                Use Save on a product page to add it here
              </p>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
