/** Only products in this category appear on `/marketplace` and homepage product APIs. */
export const MARKETPLACE_SHOES_CATEGORY_SLUG =
  process.env.NEXT_PUBLIC_MARKETPLACE_SHOES_CATEGORY_SLUG?.trim() || 'shoes'