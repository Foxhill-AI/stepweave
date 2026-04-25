/**
 * Blog feature configuration (4.4).
 * Blog is on by default. Set `NEXT_PUBLIC_ENABLE_BLOG=false` to hide nav links and 404 `/blog`.
 * Optional: `NEXT_PUBLIC_ARTICLE_SEARCH_ENABLED=true` for blog index search.
 */

function envBoolValue(v: string | undefined): boolean {
  if (v === undefined || v === null) return false
  const s = String(v).trim().toLowerCase()
  return s === 'true' || s === '1'
}

function envBoolValueDefaultTrue(v: string | undefined): boolean {
  if (v === undefined || v === null) return true
  const t = String(v).trim()
  if (t === '') return true
  const s = t.toLowerCase()
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false
  return envBoolValue(v)
}

/** Blog routes and nav links; disabled only when `NEXT_PUBLIC_ENABLE_BLOG` is explicitly falsey. */
export function isBlogEnabled(): boolean {
  return envBoolValueDefaultTrue(process.env.NEXT_PUBLIC_ENABLE_BLOG)
}

/** If true, blog index shows search/filter UI. */
export function isArticleSearchEnabled(): boolean {
  return envBoolValue(process.env.NEXT_PUBLIC_ARTICLE_SEARCH_ENABLED)
}
