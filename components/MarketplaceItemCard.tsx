import Link from 'next/link'
import { Heart, ShoppingCart, Package, Truck } from 'lucide-react'
import '../styles/MarketplaceItemCard.css'

interface MarketplaceItemCardProps {
  id: string
  title: string
  author: string
  image?: string
  likes?: number
  price: string
  shippingInfo?: string
  inStock?: boolean
  promotionalText?: string
  firstVariantId?: number
  unitPrice?: number
  onAddToCart?: (variantId: number, quantity: number, unitPrice: number) => void
}

export default function MarketplaceItemCard({
  id,
  title,
  author,
  image,
  likes = 0,
  price,
  shippingInfo = 'Free shipping',
  inStock = true,
  promotionalText,
  firstVariantId,
  unitPrice,
  onAddToCart,
}: MarketplaceItemCardProps) {
  return (
    <article className="marketplace-item-card" aria-label={`Product: ${title}`}>
      <Link href={`/item/${id}`} className="marketplace-item-card-link">
        <div className="marketplace-item-image-wrapper">
          <div className="marketplace-item-image-placeholder">
            {image ? (
              <img
                src={image}
                alt={title}
                className="marketplace-item-image"
                loading="lazy"
              />
            ) : (
              <div className="marketplace-item-image-fallback">
                <span>{title.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
          
          {/* Physical Product Badge */}
          <div className="marketplace-item-badge" aria-label="Physical product">
            <Package size={14} />
            <span>Physical Product</span>
          </div>

          {promotionalText && (
            <div className="marketplace-item-promotional" aria-label="Promotional offer">
              {promotionalText}
            </div>
          )}

          {!inStock && (
            <div className="marketplace-item-out-of-stock" aria-label="Out of stock">
              Out of Stock
            </div>
          )}
        </div>

        <div className="marketplace-item-content">
          <h3 className="marketplace-item-title">{title}</h3>
          <p className="marketplace-item-author">by {author}</p>
          
          {/* Price Section - Prominent */}
          <div className="marketplace-item-price-section">
            <span className="marketplace-item-price">{price}</span>
            {shippingInfo && (
              <div className="marketplace-item-shipping">
                <Truck size={12} />
                <span>{shippingInfo}</span>
              </div>
            )}
          </div>

          <div className="marketplace-item-meta">
            {likes > 0 && (
              <span className="marketplace-item-stat" aria-label={`${likes} likes`}>
                <Heart size={14} aria-hidden="true" />
                {likes}
              </span>
            )}
          </div>

          {/* Buy Button */}
          <button
            className="marketplace-item-buy-button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (inStock && onAddToCart && firstVariantId != null && unitPrice != null) {
                onAddToCart(firstVariantId, 1, unitPrice)
              }
            }}
            disabled={!inStock}
            aria-label={`Add ${title} to cart`}
          >
            <ShoppingCart size={16} aria-hidden="true" />
            {inStock ? 'Add to Cart' : 'Out of Stock'}
          </button>
        </div>
      </Link>
    </article>
  )
}
