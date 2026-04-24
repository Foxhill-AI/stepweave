/**
 * Printful mockup URLs in design_draft.mockup_urls are only valid for display when they were
 * generated at or after the product row's last update (product.updated_at).
 */
export function areProductMockupsFresh(
  productUpdatedAt: string | null | undefined,
  mockupsGeneratedAt: string | null | undefined
): boolean {
  if (!productUpdatedAt || !mockupsGeneratedAt) return false
  const pu = new Date(productUpdatedAt).getTime()
  const mg = new Date(mockupsGeneratedAt).getTime()
  if (Number.isNaN(pu) || Number.isNaN(mg)) return false
  return mg >= pu
}
