import type { ProductListingRow } from '@/lib/supabaseClient'

export type ShoeAudienceFilter = 'all' | 'men' | 'women'

type ListingLike = Pick<ProductListingRow, 'name' | 'design_data'>

/**
 * Infer men's vs women's from the Printful catalog title stored on publish
 * (`design_data.model_name`) and the listing name as fallback.
 */
export function shoeAudienceFromListing(row: ListingLike): 'men' | 'women' | null {
  const design = row.design_data as { model_name?: string } | null
  const text = [design?.model_name, row.name].filter(Boolean).join(' ').toLowerCase()
  if (!text.trim()) return null

  // Check women's patterns before men's — "women" contains "men".
  if (/\bwomen['’]?s\b|\bwomens\b|\bwoman\b|\bladies\b|\blady\b|\bfemale\b/.test(text)) {
    return 'women'
  }
  if (/\bmen['’]?s\b|\bmens\b|\bmale\b/.test(text)) {
    return 'men'
  }
  if (/\bman\b/.test(text) && !/\bwoman\b/.test(text)) {
    return 'men'
  }
  return null
}

export function filterListingsByShoeAudience<T extends ListingLike>(
  rows: T[],
  filter: ShoeAudienceFilter
): T[] {
  if (filter === 'all') return rows
  return rows.filter((row) => shoeAudienceFromListing(row) === filter)
}

export const SHOE_AUDIENCE_FILTER_OPTIONS: Array<{ value: ShoeAudienceFilter; label: string }> = [
  { value: 'all', label: 'All Shoes' },
  { value: 'men', label: "Men's Shoes" },
  { value: 'women', label: "Women's Shoes" },
]
