import { PRINTFUL_SLOT_BUSY_CODE } from '@/lib/printful/mockupSlot'
import { PRINTFUL_RATE_LIMITED_CODE } from '@/lib/printful/mockupTask'
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

/** Slot-busy retries are cheap; rate-limit waits are ~60s — keep a wall-clock budget. */
const DEFAULT_MAX_ATTEMPTS = 24
const DEFAULT_MAX_WAIT_MS = 6 * 60_000
const RATE_LIMIT_WAIT_CAP_MS = 90_000
const SLOT_BUSY_WAIT_CAP_MS = 10_000

function placementsHaveDisplayUrls(placements: PreviewMockupPlacement[] | undefined): boolean {
  if (!placements?.length) return false
  return countMockupDisplayUrls(placements) > 0
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const t = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
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
 * Poll draft mockups until display URLs appear or the deadline hits.
 * Used when the preview POST times out / drops but the server may still persist results.
 */
export async function pollDraftMockupsForDisplay(
  draftId: number,
  options?: { maxWaitMs?: number; intervalMs?: number; signal?: AbortSignal }
): Promise<PreviewMockupPlacement[]> {
  const maxWaitMs = options?.maxWaitMs ?? 180_000
  const intervalMs = options?.intervalMs ?? 4_000
  const signal = options?.signal
  const deadline = Date.now() + maxWaitMs

  while (Date.now() < deadline) {
    if (signal?.aborted) break
    const placements = await fetchDraftMockupsForDisplay(draftId, signal)
    if (placementsHaveDisplayUrls(placements)) return placements
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await sleep(Math.min(intervalMs, remaining), signal)
  }
  return []
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

function isRetryableBusy(status: number, body: PreviewMockupsResponseBody): boolean {
  if (status === 503 && body.code === PRINTFUL_SLOT_BUSY_CODE) return true
  if (status === 429 && body.code === PRINTFUL_RATE_LIMITED_CODE) return true
  if (status === 429) return true
  return false
}

function retryWaitMs(status: number, body: PreviewMockupsResponseBody): number {
  const raw = typeof body.retry_after_ms === 'number' ? body.retry_after_ms : NaN
  if (status === 429 || body.code === PRINTFUL_RATE_LIMITED_CODE) {
    return Math.min(
      RATE_LIMIT_WAIT_CAP_MS,
      Math.max(2_000, Number.isFinite(raw) ? raw : 65_000)
    )
  }
  return Math.min(
    SLOT_BUSY_WAIT_CAP_MS,
    Math.max(400, Number.isFinite(raw) ? raw : 2_000)
  )
}

/**
 * POST preview-mockups with client-side retries for Printful slot busy and rate limits.
 * Long 429 waits happen here (browser), not inside the Vercel function.
 */
export async function fetchPreviewMockupsWithRetry(
  draftId: number,
  options?: { maxAttempts?: number; maxWaitMs?: number; signal?: AbortSignal }
): Promise<{ ok: boolean; status: number; body: PreviewMockupsResponseBody }> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const deadline = Date.now() + (options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS)
  let lastStatus = 500
  let lastBody: PreviewMockupsResponseBody = {}

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (options?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    if (Date.now() >= deadline) break

    const res = await fetch(`/api/design-drafts/${draftId}/preview-mockups`, {
      method: 'POST',
      signal: options?.signal,
    })
    lastStatus = res.status
    lastBody = (await res.json().catch(() => ({}))) as PreviewMockupsResponseBody

    if (isRetryableBusy(res.status, lastBody)) {
      const wait = retryWaitMs(res.status, lastBody)
      const remaining = deadline - Date.now()
      if (remaining <= 0) break
      console.warn('[preview-mockups] retryable', {
        status: res.status,
        code: lastBody.code,
        attempt: attempt + 1,
        wait_ms: Math.min(wait, remaining),
      })
      await sleep(Math.min(wait, remaining), options?.signal)
      continue
    }

    return { ok: res.ok, status: lastStatus, body: lastBody }
  }

  return { ok: false, status: lastStatus, body: lastBody }
}
