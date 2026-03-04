import ItemCard from '../components/ItemCard'
import Carousel from '../components/Carousel'
import '../styles/ContentSection.css'

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

interface ContentSectionProps {
  title: string
  items: Item[]
  showAsCarousel?: boolean
  showAsGrid?: boolean
  /** Slug for the "View more" link (e.g. 'trending-now'). When set, adds a View more card at the end of the carousel. */
  sectionSlug?: string
}

export default function ContentSection({
  title,
  items,
  showAsCarousel = true,
  showAsGrid = false,
  sectionSlug,
}: ContentSectionProps) {
  if (showAsGrid) {
    return (
      <section className="content-section" aria-labelledby={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        <h2 id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`} className="content-section-title">
          {title}
        </h2>
        <div className="content-section-grid">
          {items.map((item) => (
            <ItemCard key={item.id} {...item} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <Carousel
      title={title}
      viewMoreHref={sectionSlug ? `/explore/${sectionSlug}` : undefined}
    >
      {items.map((item) => (
        <ItemCard key={item.id} {...item} />
      ))}
    </Carousel>
  )
}
