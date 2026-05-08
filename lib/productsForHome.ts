import type { ProductListingRow } from '@/lib/supabaseClient'

/** Item shape for ContentSection / ItemCard (id links to /item/[id]) */
export interface HomeItem {
  id: string
  productId?: number
  designData?: { imageUrl?: string; source?: string } | null
  title: string
  category: string
  image?: string
  views?: number
  likes?: number
  downloads?: number
  author?: string
  authorProfileUrl?: string
  price?: string
  rating?: number
  badge?: string
  /** ISO `product.created_at` (display / legacy sort). */
  createdAt?: string
  /** ISO `product.updated_at` when present — listing changes after create. */
  updatedAt?: string
}

/** Latest instant from `created_at` / `updated_at` (whichever is newer). */
export function listingRecencyMs(
  row:
    | (Pick<ProductListingRow, 'created_at'> & { updated_at?: string | null })
    | (Pick<HomeItem, 'createdAt' | 'updatedAt'>)
): number {
  const candidates: string[] = []
  if ('created_at' in row && row.created_at != null) candidates.push(String(row.created_at))
  if ('updated_at' in row && row.updated_at != null) candidates.push(String(row.updated_at))
  if ('createdAt' in row && row.createdAt != null) candidates.push(String(row.createdAt))
  if ('updatedAt' in row && row.updatedAt != null) candidates.push(String(row.updatedAt))
  let max = 0
  for (const raw of candidates) {
    const t = new Date(raw).getTime()
    if (Number.isFinite(t) && t > max) max = t
  }
  return max
}

/** Parse listing time for sort/compare; invalid/missing dates → 0. */
export function listingCreatedMs(
  row: Pick<ProductListingRow, 'created_at'> | Pick<HomeItem, 'createdAt'>
): number {
  const raw =
    'created_at' in row && row.created_at != null
      ? String(row.created_at)
      : 'createdAt' in row && row.createdAt != null
        ? String(row.createdAt)
        : ''
  if (!raw) return 0
  const t = new Date(raw).getTime()
  return Number.isFinite(t) ? t : 0
}

/** True if newest of `created_at` / `updated_at` is within the last `days` (“New” badge). */
export function isListingNewWithinDays(
  row: Pick<ProductListingRow, 'created_at'> & { updated_at?: string | null },
  days = 7
): boolean {
  const t = listingRecencyMs(row)
  if (t <= 0) return false
  return (Date.now() - t) / 86_400_000 <= days
}

/** Newest listing activity first (`max(created_at, updated_at)`); ties by higher product id. */
export function sortProductRowsNewestFirst(rows: ProductListingRow[]): ProductListingRow[] {
  return [...rows].sort((a, b) => {
    const d = listingRecencyMs(b) - listingRecencyMs(a)
    if (d !== 0) return d
    return Number(b.id) - Number(a.id)
  })
}

/**
 * “Brand New” strip: prefer listings from the last 7 days, then pad with newest overall
 * so the homepage always has enough cards when few items qualify as “New.”
 */
export function mergeBrandNewStrip(
  brandNewFirst: ProductListingRow[],
  fillFromNewest: ProductListingRow[],
  max = 50
): ProductListingRow[] {
  const seen = new Set<number>()
  const out: ProductListingRow[] = []
  for (const r of brandNewFirst) {
    const id = Number(r.id)
    if (!Number.isFinite(id) || seen.has(id)) continue
    seen.add(id)
    out.push(r)
    if (out.length >= max) return out
  }
  for (const r of fillFromNewest) {
    const id = Number(r.id)
    if (!Number.isFinite(id) || seen.has(id)) continue
    seen.add(id)
    out.push(r)
    if (out.length >= max) break
  }
  return out
}

/** Newest first for UI items (stable when timestamps tie). */
export function sortHomeItemsByNewestFirst(items: HomeItem[]): HomeItem[] {
  return [...items].sort((a, b) => {
    const d = listingRecencyMs(b) - listingRecencyMs(a)
    if (d !== 0) return d
    return Number(b.productId ?? b.id) - Number(a.productId ?? a.id)
  })
}

/** Build a home list item; optional `viewsByProductId` fills view counts from the API. */
export function homeItemFromProductRow(
  row: ProductListingRow,
  viewsByProductId?: Record<string, number>
): HomeItem {
  const base = productToHomeItem(row)
  const n = viewsByProductId?.[String(row.id)]
  if (typeof n === 'number' && n >= 0) return { ...base, views: n }
  return base
}

export function homeItemsFromProductRows(
  rows: ProductListingRow[],
  viewsByProductId?: Record<string, number>
): HomeItem[] {
  return rows.map((row) => homeItemFromProductRow(row, viewsByProductId))
}

export function productToHomeItem(row: ProductListingRow): HomeItem {
  const category = row.product_category?.[0]?.category
  const categoryLabel = category?.name ?? category?.slug ?? ''
  const designData = row.design_data as { imageUrl?: string; source?: string } | null
  const isNew = isListingNewWithinDays(row, 7)
  return {
    id: String(row.id),
    productId: row.id as number,
    designData,
    title: row.name,
    category: categoryLabel,
    image: designData?.imageUrl,
    views: 0,
    likes: 0,
    downloads: 0,
    author:
      row.user_account?.user_public_profile?.username ?? row.user_account?.username ?? undefined,
    authorProfileUrl: (() => {
      const name =
        row.user_account?.user_public_profile?.username ?? row.user_account?.username
      return name ? `/profile/${encodeURIComponent(name)}` : undefined
    })(),
    price: `$${Number(row.price).toFixed(2)}`,
    rating: 0,
    badge: isNew ? 'New' : undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}

export const SECTION_SLUG_TO_TITLE: Record<string, string> = {
  'trending-now': 'Trending Now',
  'most-popular': 'Most Popular',
  'brand-new': 'Brand New',
}

export const VALID_SECTION_SLUGS = Object.keys(SECTION_SLUG_TO_TITLE)
