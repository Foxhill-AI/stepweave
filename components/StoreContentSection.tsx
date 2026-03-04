import StoreItemCard from './StoreItemCard'
import Carousel from './Carousel'
import { ArrowRight, FileDown } from 'lucide-react'
import '../styles/DigitalStore.css'

interface StoreItem {
  id: string
  title: string
  author: string
  image?: string
  likes?: number
  downloads?: number
  promotionalText?: string
}

interface StoreContentSectionProps {
  title: string
  items: StoreItem[]
}

export default function StoreContentSection({
  title,
  items,
}: StoreContentSectionProps) {
  return (
    <section className="store-section carousel-section">
      <div className="store-section-header">
        <h2 className="store-section-title">
          {title}
          <ArrowRight size={20} aria-hidden="true" />
        </h2>
        <div className="store-section-badge">
          <FileDown size={14} />
          <span>Digital Files</span>
        </div>
      </div>
      <Carousel>
        {items.map((item) => (
          <StoreItemCard
            key={item.id}
            id={item.id}
            title={item.title}
            author={item.author}
            image={item.image}
            likes={item.likes}
            downloads={item.downloads}
            promotionalText={item.promotionalText}
          />
        ))}
      </Carousel>
    </section>
  )
}
