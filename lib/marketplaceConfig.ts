/**
 * Optional shoes category slug (env). Public browse APIs currently show **all** active products;
 * this constant remains for filters, Printful tooling, or future category-scoped browse.
 */
export const MARKETPLACE_SHOES_CATEGORY_SLUG =
  process.env.NEXT_PUBLIC_MARKETPLACE_SHOES_CATEGORY_SLUG?.trim() || 'shoes'

/** Minimal shape for filtering listings without importing heavy DB types. */
export type ShoeListingLike = {
  design_data: Record<string, unknown> | null
  product_category: Array<{ category?: { slug?: string } | null }>
}

/**
 * True if the listing is a shoe product: tagged with the shoes category, or created from the
 * design-tool draft flow (`design_data.source === 'design_draft'`) when category may be unset.
 */
export function productIsShoeListing(row: ShoeListingLike): boolean {
  if (
    row.product_category?.some(
      (pc) => pc.category?.slug === MARKETPLACE_SHOES_CATEGORY_SLUG
    )
  ) {
    return true
  }
  const src = row.design_data && typeof row.design_data === 'object'
    ? (row.design_data as { source?: string }).source
    : undefined
  return src === 'design_draft'
}