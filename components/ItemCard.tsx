import Link from 'next/link'
import { Heart, Eye, Download, Star } from 'lucide-react'
import '../styles/ItemCard.css'

interface ItemCardProps {
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
  /** 'grid' = default card; 'list' = horizontal row (e.g. search results). */
  layout?: 'grid' | 'list'
}

export default function ItemCard({
  id,
  title,
  category,
  image,
  views = 0,
  likes = 0,
  downloads = 0,
  author,
  price,
  rating = 0,
  badge,
  layout = 'grid',
}: ItemCardProps) {
  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

    return (
      <div className="item-card-rating">
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star key={`${id}-full-${i}`} size={14} className="star-full" fill="currentColor" />
        ))}
        {hasHalfStar && (
          <Star key={`${id}-half`} size={14} className="star-half" fill="currentColor" />
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star key={`${id}-empty-${i}`} size={14} className="star-empty" />
        ))}
        <span className="rating-value">{rating.toFixed(1)}</span>
      </div>
    )
  }
  return (
    <article
      className={`item-card ${layout === 'list' ? 'item-card-list' : ''}`}
      aria-label={`Item: ${title}`}
    >
      <Link href={`/item/${id}`} className="item-card-link">
        <div className="item-card-image-wrapper">
          <div className="item-card-image-placeholder">
            {image ? (
              <img
                src={image}
                alt={title}
                className="item-card-image"
                loading="lazy"
              />
            ) : (
              <div className="item-card-image-fallback">
                <span>{title.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
          {badge && (
            <div className="item-card-badge" aria-label={`Badge: ${badge}`}>
              {badge}
            </div>
          )}
        </div>

        <div className="item-card-content">
          <h3 className="item-card-title">{title}</h3>
          {author && (
            <p className="item-card-author">by {author}</p>
          )}
          {rating > 0 && renderStars(rating)}
          <div className="item-card-meta">
            {views > 0 && (
              <span className="item-card-stat" aria-label={`${views} views`}>
                <Eye size={14} aria-hidden="true" />
                {views >= 1000 ? `${(views / 1000).toFixed(1)}k` : views}
              </span>
            )}
            {likes > 0 && (
              <span className="item-card-stat" aria-label={`${likes} likes`}>
                <Heart size={14} aria-hidden="true" />
                {likes >= 1000 ? `${(likes / 1000).toFixed(1)}k` : likes}
              </span>
            )}
            {downloads > 0 && (
              <span className="item-card-stat" aria-label={`${downloads} downloads`}>
                <Download size={14} aria-hidden="true" />
                {downloads >= 1000 ? `${(downloads / 1000).toFixed(1)}k` : downloads}
              </span>
            )}
          </div>
          <div className="item-card-footer">
            {category && (
              <span className="item-card-category">{category}</span>
            )}
            {price && (
              <span className="item-card-price" aria-label={`Price: ${price}`}>
                {price}
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  )
}
