import { sleep } from '@/lib/printful/sleep'

export const PRINTFUL_BASE = 'https://api.printful.com'

export const POLL_INTERVAL_MS = 3000
export const FIRST_WAIT_MS = 12000
export const PER_TASK_MAX_MS = 75000
export const MAX_429_RETRIES = 8

export type PrintfulPrintfilesResult = {
  printfiles?: Array<{
    printfile_id: number
    width: number
    height: number
  }>
  variant_printfiles?: Array<{
    variant_id: number
    placements: Record<string, number>
  }>
  available_placements?: Record<string, string>
  option_groups?: string[]
}

export type FileEntry = {
  placement: string
  image_url: string
  position: {
    area_width: number
    area_height: number
    width: number
    height: number
    top: number
    left: number
  }
}

export function parse429WaitMs(responseText: string): number {
  try {
    const j = JSON.parse(responseText) as { result?: string; error?: { message?: string } }
    const msg = String(j.result ?? j.error?.message ?? '')
    const m = /after (\d+) seconds?/i.exec(msg)
    if (m) return parseInt(m[1], 10) * 1000 + 3500
  } catch {
    /* ignore */
  }
  return 65000
}

/** Optional Printful create-task fields (e.g. silhouette templates). */
export type CreateMockupTaskOptions = {
  option_groups?: string[]
}

export type MockupExtra = {
  title?: string
  mockup_url?: string
}

export type MockupResult = {
  placement: string
  mockup_url?: string
  extra_mockups?: MockupExtra[]
  /** Populated by Printful when multiple option_groups are requested. */
  option_group?: string
}

export async function createTaskAndPoll(
  productId: string,
  variantId: number,
  files: FileEntry[],
  headers: HeadersInit,
  options?: CreateMockupTaskOptions
): Promise<
  | { ok: true; mockups: MockupResult[] }
  | { ok: false; reason: string; status?: number }
> {
  let createRes: Response | null = null
  let bodyText = ''

  const taskRequestBody: Record<string, unknown> = {
    variant_ids: [variantId],
    format: 'png',
    files,
  }
  if (options?.option_groups?.length) {
    taskRequestBody.option_groups = options.option_groups
  }

  for (let r = 0; r < MAX_429_RETRIES; r++) {
    createRes = await fetch(`${PRINTFUL_BASE}/mockup-generator/create-task/${productId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(taskRequestBody),
    })
    bodyText = await createRes.text()

    if (createRes.status === 429) {
      const wait = parse429WaitMs(bodyText)
      console.warn('[printful mockup] 429 create-task, waiting ms', wait)
      await sleep(wait)
      continue
    }
    break
  }

  if (!createRes?.ok) {
    console.error('[printful mockup] create-task', createRes?.status, bodyText)
    return { ok: false, reason: 'create-task failed', status: createRes?.status }
  }

  let parsedCreate: { result?: { task_key?: string } }
  try {
    parsedCreate = JSON.parse(bodyText) as { result?: { task_key?: string } }
  } catch {
    return { ok: false, reason: 'invalid create response' }
  }

  const taskKey = parsedCreate.result?.task_key
  if (!taskKey) {
    return { ok: false, reason: 'no task_key' }
  }

  await sleep(FIRST_WAIT_MS)
  const deadline = Date.now() + PER_TASK_MAX_MS

  while (Date.now() < deadline) {
    const taskRes = await fetch(
      `${PRINTFUL_BASE}/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`,
      { headers }
    )
    if (!taskRes.ok) {
      return { ok: false, reason: 'task fetch failed' }
    }
    const taskData = (await taskRes.json()) as {
      result?: {
        status?: string
        error?: string
        error_code?: number
        mockups?: MockupResult[]
      }
    }
    const result = taskData.result ?? {}
    const status = result.status

    if (status === 'completed') {
      return { ok: true, mockups: result.mockups ?? [] }
    }
    if (status === 'failed' || status === 'error') {
      console.error('[printful mockup] task failed', {
        taskKey,
        error: result.error,
        error_code: result.error_code,
        placements: files.map((f) => f.placement),
      })
      return { ok: false, reason: 'task failed' }
    }
    await sleep(POLL_INTERVAL_MS)
  }

  return { ok: false, reason: 'timeout' }
}

export function mergeMockups(
  urlByPlacement: Map<string, string>,
  mockups: MockupResult[]
) {
  for (const m of mockups) {
    const u = (m.mockup_url ?? '').trim()
    // Only store the first (default) URL per placement; extras collected separately
    if (u && !urlByPlacement.has(m.placement)) urlByPlacement.set(m.placement, u)
  }
}
