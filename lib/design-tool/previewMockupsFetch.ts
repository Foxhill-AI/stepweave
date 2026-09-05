import { PRINTFUL_SLOT_BUSY_CODE } from '@/lib/printful/mockupSlot'
import {
  countMockupDisplayUrls,
} from '@/lib/productMockups/storage'

export type PreviewMockupPlacement = {
  placement: string
  label: string
  mockup_url: string
  view?: string
  extra_mockups?: Array<{ title: string; mockup_url: string; view?: string }>
}

export type PreviewMockupsResponseBody = {
  product_id?: string
  variant_id?: number
  placements?: PreviewMockupPlacement[]
  mockup_generation_unavailable?: boolean
  mockups_persisted?: boolean
  from_cache?: boolean
  display_url_count?: number
  mockup_error?: string
  error?: string
  code?: string
  retry_after_ms?: number
}

const DEFAULT_MAX_ATTEMPTS = 18

function placementsHaveDisplayUrls(placements: PreviewMockupPlacement[] | undefined): boolean {
  if (!placements?.length) return false
  return countMockupDisplayUrls(placements) > 0
}

/**
 * When the preview POST returns empty display URLs but mockups were persisted,
 * reload signed URLs the same way the marketplace does.
 */
export async function fetchDraftMockupsForDisplay(
  draftId: number,
  signal?: AbortSignal
): Promise<PreviewMockupPlacement[]> {
  const res = await fetch(`/api/design-drafts/${draftId}/mockups`, { signal })
  if (!res.ok) return []
  const body = (await res.json().catch(() => ({}))) as {
    placements?: PreviewMockupPlacement[]
  }
  return Array.isArray(body.placements) ? body.placements : []
}

/**
 * Normalize preview API result: prefer response placements; if empty but persisted, reload from draft.
 */
export async function resolvePreviewPlacementsForClient(
  draftId: number,
  body: PreviewMockupsResponseBody,
  signal?: AbortSignal
): Promise<{ placements: PreviewMockupPlacement[]; catalogOnly: boolean }> {
  const fromBody = Array.isArray(body.placements) ? body.placements : []
  if (placementsHaveDisplayUrls(fromBody)) {
    return { placements: fromBody, catalogOnly: false }
  }
  if (body.mockups_persisted) {
    const reloaded = await fetchDraftMockupsForDisplay(draftId, signal)
    if (placementsHaveDisplayUrls(reloaded)) {
      return { placements: reloaded, catalogOnly: false }
    }
  }
  return {
    placements: [],
    catalogOnly: Boolean(body.mockup_generation_unavailable) || !body.mockups_persisted,
  }
}

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
