import Link from 'next/link'
import { Heart, Download, UserPlus, FileDown } from 'lucide-react'
import '../styles/StoreItemCard.css'

interface StoreItemCardProps {
  id: string
  title: string
  author: string
  image?: string
  likes?: number
  downloads?: number
  promotionalText?: string
}

export default function StoreItemCard({
  id,
  title,
  author,
  image,
  likes = 0,
  downloads = 0,
  promotionalText,
}: StoreItemCardProps) {
  return (
    <article className="store-item-card" aria-label={`Item: ${title}`}>
      <Link href={`/item/${id}`} className="store-item-card-link">
        <div className="store-item-image-wrapper">
          <div className="store-item-image-placeholder">
            {image ? (
              <img
                src={image}
                alt={title}
                className="store-item-image"
                loading="lazy"
              />
            ) : (
              <div className="store-item-image-fallback">
                <span>{title.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
          
          {/* Digital Download Badge */}
          <div className="store-item-digital-badge" aria-label="Digital download">
            <FileDown size={14} />
            <span>Digital Download</span>
          </div>
          
          {promotionalText && (
            <div className="store-item-promotional" aria-label="Promotional offer">
              {promotionalText}
            </div>
          )}
          <button
            className="store-item-follow-button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              // Handle follow action
            }}
            aria-label={`Follow ${author}`}
          >
            <UserPlus size={16} aria-hidden="true" />
            Follow
          </button>
        </div>

        <div className="store-item-content">
          <h3 className="store-item-title">{title}</h3>
          <p className="store-item-author">by {author}</p>
          <div className="store-item-meta">
            {likes > 0 && (
              <span className="store-item-stat" aria-label={`${likes} likes`}>
                <Heart size={14} aria-hidden="true" />
                {likes}
              </span>
            )}
            {downloads > 0 && (
              <span className="store-item-stat" aria-label={`${downloads} downloads`}>
                <Download size={14} aria-hidden="true" />
                {downloads}
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  )
}
