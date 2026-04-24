import { PRINTFUL_SLOT_BUSY_CODE } from '@/lib/printful/mockupSlot'

export type PreviewMockupsResponseBody = {
  product_id?: string
  variant_id?: number
  placements?: Array<{
    placement: string
    label: string
    mockup_url: string
    extra_mockups?: Array<{ title: string; mockup_url: string }>
  }>
  mockup_generation_unavailable?: boolean
  mockup_error?: string
  error?: string
  code?: string
  retry_after_ms?: number
}

const DEFAULT_MAX_ATTEMPTS = 18

/**
 * POST preview-mockups with retries when the server returns PRINTFUL_SLOT_BUSY (serialized Printful usage).
 */
export async function fetchPreviewMockupsWithRetry(
  draftId: number,
  options?: { maxAttempts?: number; signal?: AbortSignal }
): Promise<{ ok: boolean; status: number; body: PreviewMockupsResponseBody }> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  let lastStatus = 500
  let lastBody: PreviewMockupsResponseBody = {}

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`/api/design-drafts/${draftId}/preview-mockups`, {
      method: 'POST',
      signal: options?.signal,
    })
    lastStatus = res.status
    lastBody = (await res.json().catch(() => ({}))) as PreviewMockupsResponseBody

    if (
      res.status === 503 &&
      lastBody.code === PRINTFUL_SLOT_BUSY_CODE
    ) {
      const wait = Math.min(
        10_000,
        Math.max(400, typeof lastBody.retry_after_ms === 'number' ? lastBody.retry_after_ms : 2000)
      )
      await new Promise((r) => setTimeout(r, wait))
      continue
    }

    return { ok: res.ok, status: res.status, body: lastBody }
  }

  return { ok: false, status: lastStatus, body: lastBody }
}
