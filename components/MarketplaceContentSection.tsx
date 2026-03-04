import MarketplaceItemCard from './MarketplaceItemCard'
import Carousel from './Carousel'
import '../styles/MarketplaceContentSection.css'

interface MarketplaceItem {
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
}

interface MarketplaceContentSectionProps {
  title: string
  items: MarketplaceItem[]
  onAddToCart?: (variantId: number, quantity: number, unitPrice: number) => void
}

export default function MarketplaceContentSection({
  title,
  items,
  onAddToCart,
}: MarketplaceContentSectionProps) {
  return (
    <section className="marketplace-content-section" aria-labelledby={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="marketplace-content-section-header">
        <h2 id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`} className="marketplace-content-section-title">
          {title}
        </h2>
        <div className="marketplace-content-section-badge">
          <span>Physical Products</span>
        </div>
      </div>
      <Carousel>
        {items.map((item) => (
          <MarketplaceItemCard
            key={item.id}
            {...item}
            firstVariantId={item.firstVariantId}
            unitPrice={item.unitPrice}
            onAddToCart={onAddToCart}
          />
        ))}
      </Carousel>
    </section>
  )
}
