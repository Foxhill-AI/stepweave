/**
 * Blog feature configuration (4.4).
 * Set in .env: NEXT_PUBLIC_ENABLE_BLOG=true, NEXT_PUBLIC_ARTICLE_SEARCH_ENABLED=true
 */

function envBoolValue(v: string | undefined): boolean {
  if (v === undefined || v === null) return false
  const s = String(v).trim().toLowerCase()
  return s === 'true' || s === '1'
}

/** If false, /blog and /blog/[slug] are not available and Blog is hidden from nav. */
export function isBlogEnabled(): boolean {
  return envBoolValue(process.env.NEXT_PUBLIC_ENABLE_BLOG)
}

/** If true, blog index shows search/filter UI. */
export function isArticleSearchEnabled(): boolean {
  return envBoolValue(process.env.NEXT_PUBLIC_ARTICLE_SEARCH_ENABLED)
}
