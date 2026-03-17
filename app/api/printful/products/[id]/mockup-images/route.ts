import { NextRequest, NextResponse } from 'next/server'

const PRINTFUL_BASE = 'https://api.printful.com'

const DEFAULT_PLACEHOLDER_IMAGE_URL = 'https://via.placeholder.com/1500/FFFFFF/FFFFFF?text=+'

const POLL_INTERVAL_MS = 3000
const FIRST_WAIT_MS = 12000
const PER_TASK_MAX_MS = 75000
/** Min delay between create-task calls to reduce 429 (Printful ~2–10/min) */
const BETWEEN_CREATE_TASK_MS = 52000
const MAX_429_RETRIES = 8

type PrintfulPrintfilesResult = {
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
}

type FileEntry = {
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

export type PlacementMockup = {
  placement: string
  label: string
  mockup_url: string
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function parse429WaitMs(responseText: string): number {
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

/** Placements like label_inside must be sent with at least one "main" placement (Printful API). */
function isAdditionalPlacement(placement: string): boolean {
  const p = placement.toLowerCase()
  return (
    p === 'label_inside' ||
    p.includes('inside') ||
    p.includes('inner_label') ||
    p.includes('neck_label')
  )
}

async function createTaskAndPoll(
  productId: string,
  variantId: number,
  files: FileEntry[],
  headers: HeadersInit
): Promise<
  | { ok: true; mockups: Array<{ placement: string; mockup_url?: string }> }
  | { ok: false; reason: string; status?: number }
> {
  let createRes: Response | null = null
  let bodyText = ''

  for (let r = 0; r < MAX_429_RETRIES; r++) {
    createRes = await fetch(`${PRINTFUL_BASE}/mockup-generator/create-task/${productId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        variant_ids: [variantId],
        format: 'png',
        files,
      }),
    })
    bodyText = await createRes.text()

    if (createRes.status === 429) {
      const wait = parse429WaitMs(bodyText)
      console.warn('[mockup-images] 429 create-task, waiting ms', wait)
      await sleep(wait)
      continue
    }
    break
  }

  if (!createRes?.ok) {
    console.error('[mockup-images] create-task', createRes?.status, bodyText)
    return { ok: false, reason: 'create-task failed', status: createRes?.status }
  }

  let createBody: { result?: { task_key?: string } }
  try {
    createBody = JSON.parse(bodyText) as { result?: { task_key?: string } }
  } catch {
    return { ok: false, reason: 'invalid create response' }
  }

  const taskKey = createBody.result?.task_key
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
        mockups?: Array<{ placement: string; mockup_url?: string }>
      }
    }
    const result = taskData.result ?? {}
    const status = result.status

    if (status === 'completed') {
      return { ok: true, mockups: result.mockups ?? [] }
    }
    if (status === 'failed' || status === 'error') {
      console.warn('[mockup-images] task failed', {
        taskKey,
        placements: files.map((f) => f.placement),
      })
      return { ok: false, reason: 'task failed' }
    }
    await sleep(POLL_INTERVAL_MS)
  }

  return { ok: false, reason: 'timeout' }
}

function mergeMockups(
  urlByPlacement: Map<string, string>,
  mockups: Array<{ placement: string; mockup_url?: string }>
) {
  for (const m of mockups) {
    const u = (m.mockup_url ?? '').trim()
    if (u) urlByPlacement.set(m.placement, u)
  }
}

/**
 * GET /api/printful/products/[id]/mockup-images?variant_id=…
 * 1) Full batch. 2) Optional retry after cooldown. 3) Primaries-only, then anchor+each additional.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productIdParam } = await params
  const productId = productIdParam?.trim()
  if (!productId) {
    return NextResponse.json({ error: 'Product id required' }, { status: 400 })
  }

  const apiKey = process.env.PRINTFUL_API_KEY
  const storeId = process.env.PRINTFUL_STORE_ID?.trim()
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: 'Printful API not configured' }, { status: 503 })
  }
  if (!storeId) {
    return NextResponse.json({ error: 'Printful store ID not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const variantIdParam = searchParams.get('variant_id')

  const placeholderUrl =
    process.env.PRINTFUL_PLACEHOLDER_IMAGE_URL?.trim() ||
    (process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/api/printful/placeholder-image`
      : DEFAULT_PLACEHOLDER_IMAGE_URL)

  const headers: HeadersInit = {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    'X-PF-Store-Id': storeId,
  }

  try {
    const [productRes, printfilesRes] = await Promise.all([
      fetch(`${PRINTFUL_BASE}/products/${productId}`, { headers }),
      fetch(`${PRINTFUL_BASE}/mockup-generator/printfiles/${productId}`, { headers }),
    ])

    if (!productRes.ok) {
      console.error('[mockup-images] product', productRes.status, await productRes.text())
      return NextResponse.json({ error: 'Failed to fetch product' }, { status: 502 })
    }
    if (!printfilesRes.ok) {
      console.error('[mockup-images] printfiles', printfilesRes.status, await printfilesRes.text())
      return NextResponse.json({ error: 'Failed to fetch printfiles' }, { status: 502 })
    }

    const productData = (await productRes.json()) as {
      result?: { variants?: Array<{ id: number }> }
    }
    const printfilesData = (await printfilesRes.json()) as {
      result?: PrintfulPrintfilesResult
    }

    const variants = productData.result?.variants ?? []
    const variantIds = new Set(variants.map((v) => v.id))
    const printfilesResult = printfilesData.result ?? {}
    const availablePlacements = printfilesResult.available_placements ?? {}

    let variantId: number
    if (variantIdParam && /^\d+$/.test(variantIdParam)) {
      variantId = parseInt(variantIdParam, 10)
    } else if (variants.length > 0) {
      variantId = variants[0].id
    } else {
      return NextResponse.json({ error: 'No variants found for product' }, { status: 404 })
    }

    if (!variantIds.has(variantId)) {
      return NextResponse.json(
        { error: 'variant_id does not belong to this product' },
        { status: 400 }
      )
    }

    const variantMapping = (printfilesResult.variant_printfiles ?? []).find(
      (vp) => vp.variant_id === variantId
    )
    if (!variantMapping?.placements || Object.keys(variantMapping.placements).length === 0) {
      return NextResponse.json(
        { error: 'No print placements for this variant', placements: [] },
        { status: 200 }
      )
    }

    const placementKeys = Object.keys(variantMapping.placements).filter(
      (p) => p in availablePlacements
    )
    if (placementKeys.length === 0) {
      return NextResponse.json(
        { error: 'No overlapping placements for this product', placements: [] },
        { status: 200 }
      )
    }

    const printfileById = new Map<number, { width: number; height: number }>()
    for (const pf of printfilesResult.printfiles ?? []) {
      if (typeof pf.printfile_id === 'number' && pf.width && pf.height) {
        printfileById.set(pf.printfile_id, { width: pf.width, height: pf.height })
      }
    }

    const buildFile = (placement: string): FileEntry => {
      const printfileId = variantMapping.placements[placement]
      const pf = printfileById.get(printfileId)
      const areaWidth = pf?.width ?? 1800
      const areaHeight = pf?.height ?? 1800
      return {
        placement,
        image_url: placeholderUrl,
        position: {
          area_width: areaWidth,
          area_height: areaHeight,
          width: areaWidth,
          height: areaHeight,
          top: 0,
          left: 0,
        },
      }
    }

    const allFiles = placementKeys.map(buildFile)
    const urlByPlacement = new Map<string, string>()

    const primaryKeys = placementKeys.filter((p) => !isAdditionalPlacement(p))
    const additionalKeys = placementKeys.filter((p) => isAdditionalPlacement(p))
    const anchorForAdditional = (add: string): string | null => {
      const p = primaryKeys.find((k) => k !== add) ?? placementKeys.find((k) => k !== add)
      return p ?? null
    }

    // 1) Full batch
    let batch = await createTaskAndPoll(productId, variantId, allFiles, headers)
    if (batch.ok) mergeMockups(urlByPlacement, batch.mockups)

    // 2) One retry after cooldown (transient Printful errors)
    if (!placementKeys.every((p) => urlByPlacement.get(p))) {
      await sleep(BETWEEN_CREATE_TASK_MS)
      batch = await createTaskAndPoll(productId, variantId, allFiles, headers)
      if (batch.ok) mergeMockups(urlByPlacement, batch.mockups)
    }

    // 3) Primaries only (e.g. shoe_left + shoe_right) — avoids some full-batch failures
    if (
      primaryKeys.length >= 1 &&
      additionalKeys.length >= 1 &&
      !primaryKeys.every((p) => urlByPlacement.get(p))
    ) {
      await sleep(BETWEEN_CREATE_TASK_MS)
      const primaryFiles = primaryKeys.map(buildFile)
      const prim = await createTaskAndPoll(productId, variantId, primaryFiles, headers)
      if (prim.ok) mergeMockups(urlByPlacement, prim.mockups)
    }

    // 4) Each missing additional: main placement + additional (Printful rejects additional alone)
    for (const add of additionalKeys) {
      if (urlByPlacement.get(add)) continue
      const main = anchorForAdditional(add)
      if (!main) continue
      await sleep(BETWEEN_CREATE_TASK_MS)
      const paired = await createTaskAndPoll(
        productId,
        variantId,
        [buildFile(main), buildFile(add)],
        headers
      )
      if (paired.ok) mergeMockups(urlByPlacement, paired.mockups)
      else console.warn('[mockup-images] anchor+additional failed', add, paired)
    }

    // 5) Any primary still missing: single-placement attempt
    for (const p of primaryKeys) {
      if (urlByPlacement.get(p)) continue
      await sleep(BETWEEN_CREATE_TASK_MS)
      const one = await createTaskAndPoll(productId, variantId, [buildFile(p)], headers)
      if (one.ok) mergeMockups(urlByPlacement, one.mockups)
    }

    const placements: PlacementMockup[] = placementKeys.map((placement) => ({
      placement,
      label: availablePlacements[placement] ?? placement,
      mockup_url: urlByPlacement.get(placement) ?? '',
    }))

    const anyUrl = placements.some((p) => p.mockup_url)
    if (!anyUrl) {
      return NextResponse.json(
        {
          error: 'Mockup generation failed for all placements',
          product_id: productId,
          variant_id: variantId,
          placements,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      product_id: productId,
      variant_id: variantId,
      placements,
    })
  } catch (e) {
    console.error('[mockup-images]', e)
    return NextResponse.json({ error: 'Unexpected error generating mockups' }, { status: 500 })
  }
}
