import type { ProductListingRow } from '@/lib/supabaseClient'

/** Item shape for ContentSection / ItemCard (id links to /item/[id]) */
export interface HomeItem {
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

export function productToHomeItem(row: ProductListingRow): HomeItem {
  const category = row.product_category?.[0]?.category
  const categoryLabel = category?.name ?? category?.slug ?? ''
  const designData = row.design_data as { imageUrl?: string } | null
  const created = row.created_at ? new Date(row.created_at).getTime() : 0
  const isNew = created > 0 && (Date.now() - created) / (1000 * 60 * 60 * 24) <= 7
  return {
    id: String(row.id),
    title: row.name,
    category: categoryLabel,
    image: designData?.imageUrl,
    views: 0,
    likes: 0,
    downloads: 0,
    author: row.user_account?.username ?? undefined,
    price: `$${Number(row.price).toFixed(2)}`,
    rating: 0,
    badge: isNew ? 'New' : undefined,
  }
}

export const SECTION_SLUG_TO_TITLE: Record<string, string> = {
  'trending-now': 'Trending Now',
  'most-popular': 'Most Popular',
  'brand-new': 'Brand New',
  'digital-designs': 'Digital Designs',
}

export const VALID_SECTION_SLUGS = Object.keys(SECTION_SLUG_TO_TITLE)
