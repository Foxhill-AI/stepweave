/**
 * Optional map: cart_item.id → design_draft.id for checkout (Printful fulfillment).
 * Persisted in sessionStorage so add-to-cart flows can register a draft after `addCartItem` returns.
 */
const STORAGE_KEY = 'stepweave_design_draft_by_cart_item'

export function setDesignDraftForCartItem(cartItemId: number, designDraftId: number): void {
  if (typeof window === 'undefined') return
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const map: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    map[String(cartItemId)] = designDraftId
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota / JSON */
  }
}

/** Merge server-provided map (e.g. from request body) with sessionStorage entries. */
export function getDesignDraftByCartItemIdForCheckout(
  fromBody?: Record<string, unknown> | null
): Record<string, number> {
  const out: Record<string, number> = {}
  if (fromBody && typeof fromBody === 'object' && !Array.isArray(fromBody)) {
    for (const [k, v] of Object.entries(fromBody)) {
      const draftId = typeof v === 'number' ? v : Number(v)
      const cartItemId = Number(k)
      if (Number.isInteger(cartItemId) && cartItemId > 0 && Number.isInteger(draftId) && draftId > 0) {
        out[String(cartItemId)] = draftId
      }
    }
  }
  if (typeof window === 'undefined') return out
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return out
    const stored = JSON.parse(raw) as Record<string, unknown>
    for (const [k, v] of Object.entries(stored)) {
      const draftId = typeof v === 'number' ? v : Number(v)
      const cartItemId = Number(k)
      if (Number.isInteger(cartItemId) && cartItemId > 0 && Number.isInteger(draftId) && draftId > 0) {
        if (out[k] == null) out[k] = draftId
      }
    }
  } catch {
    /* ignore */
  }
  return out
}

export function clearDesignDraftMapForCartItems(cartItemIds: number[]): void {
  if (typeof window === 'undefined' || cartItemIds.length === 0) return
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const map = JSON.parse(raw) as Record<string, number>
    for (const id of cartItemIds) {
      delete map[String(id)]
    }
    if (Object.keys(map).length === 0) sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}
