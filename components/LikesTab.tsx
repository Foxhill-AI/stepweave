'use client'

import ItemCard from './ItemCard'
import '../styles/LikesTab.css'

export interface LikedProduct {
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

interface LikesTabProps {
  /** From getLikedProducts; undefined = loading, [] = empty */
  likedProducts?: LikedProduct[]
}

export default function LikesTab({ likedProducts }: LikesTabProps) {
  const list = likedProducts ?? []
  const isLoading = likedProducts === undefined

  return (
    <div className="likes-tab">
      <div className="likes-tab-header">
        <h3 className="likes-tab-title">Liked</h3>
        {!isLoading && (
          <span className="likes-tab-count">
            {list.length} {list.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="likes-tab-loading">
          <p>Loading liked items…</p>
        </div>
      ) : list.length > 0 ? (
        <div className="likes-tab-grid">
          {list.map((product) => (
            <ItemCard key={product.id} {...product} />
          ))}
        </div>
      ) : (
        <div className="likes-tab-empty">
          <p>You haven&apos;t liked any products yet.</p>
        </div>
      )}
    </div>
  )
}
