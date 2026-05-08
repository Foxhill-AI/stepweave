/**
 * Optional shoes category slug (env). Public browse APIs currently show **all** active products;
 * this constant remains for filters, Printful tooling, or future category-scoped browse.
 */
export const MARKETPLACE_SHOES_CATEGORY_SLUG =
  process.env.NEXT_PUBLIC_MARKETPLACE_SHOES_CATEGORY_SLUG?.trim() || 'shoes'