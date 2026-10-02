import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  parsePrintfulPlacements,
  parsePlacementImages,
  isTextLayer,
  isImageLayer,
  placementLayersNeedServerComposite,
  enrichDirectImagePlacementOverrides,
  type PlacementCompactTransform,
} from '@/lib/designDraftState'
import {
  createTaskAndPoll,
  PRINTFUL_BASE,
  type PrintfulPrintfilesResult,
} from '@/lib/printful/mockupTask'
import {
  buildMockupFileEntries,
  buildPrintfileById,
  resolvePlacementKeys,
} from '@/lib/printful/buildMockupFiles'
import {
  compositeLayersToBuffer,
  placementLayersToCompositeInputs,
} from '@/lib/printful/compositeImages'
import { isFixedBrandingPlacement } from '@/lib/printful/fixedBranding'
import { resolveFixedBrandingUrlForPrintful } from '@/lib/printful/resolveFixedBrandingUrl'
import {
  tryAcquirePrintfulMockupSlot,
  releasePrintfulMockupSlot,
} from '@/lib/printful/mockupSlot'
import {
  mockupPlacementsForDatabase,
  mockupPlacementHasDisplayUrl,
  persistPrintfulMockupsToStorage,
  type StoredMockupPlacement,
} from '@/lib/productMockups/storage'
import { getUnifiedModelPricingByEitherId } from '@/lib/printful/modelPricing'

/** Allow up to 300s — Printful mockup polling can be slow. */
export const maxDuration = 300

const BUCKET = 'design-patterns'
const SIGNED_URL_FOR_PRINTFUL_SEC = 7200

/**
 * POST /api/design-drafts/[id]/generate-womens-mockups
 *
 * Internal route — protected by x-internal-key header.
 * Generates Printful mockups using the womens partner product ID, tags each
 * placement with gender: 'womens', and merges them into design_draft.mockup_urls.
 *
 * Called fire-and-forget from create-product and self-purchase routes.
 * The caller does not wait for the response.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const draftId = Number(id)
  if (Number.isNaN(draftId)) {
    return NextResponse.json({ error: 'Invalid draft id' }, { status: 400 })
  }

  // ── Internal auth ────────────────────────────────────────────────────────
  const internalKey = request.headers.get('x-internal-key')
  const expectedKey = process.env.INTERNAL_API_SECRET?.trim()
  if (!expectedKey || internalKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const printfulApiKey = process.env.PRINTFUL_API_KEY?.trim()
  const storeId = process.env.PRINTFUL_STORE_ID?.trim()

  if (!supabaseUrl || !serviceRoleKey || !printfulApiKey || !storeId) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  // ── Load draft ───────────────────────────────────────────────────────────
  const { data: draft } = await admin
    .from('design_draft')
    .select('id, user_account_id, base_model_id, pattern_image_url, design_state, mockup_urls, structural_color')
    .eq('id', draftId)
    .maybeSingle()

  if (!draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  // ── Early exit if womens mockups already exist ───────────────────────────
  const existingMockups = (Array.isArray(draft.mockup_urls) ? draft.mockup_urls : []) as StoredMockupPlacement[]
  if (existingMockups.some((p) => p.gender === 'womens')) {
    return NextResponse.json({ skipped: true, reason: 'already_generated' })
  }

  // ── Get auth_user_id for storage paths ───────────────────────────────────
  const { data: userAccount } = await admin
    .from('user_account')
    .select('auth_user_id')
    .eq('id', draft.user_account_id as number)
    .maybeSingle()

  const authUserId = (userAccount?.auth_user_id as string | null) ?? null
  if (!authUserId) {
    console.error('[generate-womens-mockups] user_account not found for draft', draftId)
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // ── Resolve womens product ID ─────────────────────────────────────────────
  const baseModelId = typeof draft.base_model_id === 'string' ? draft.base_model_id.trim() : ''
  const unifiedPricing = getUnifiedModelPricingByEitherId(baseModelId)
  if (!unifiedPricing) {
    console.error('[generate-womens-mockups] no unified pricing for base_model_id', baseModelId)
    return NextResponse.json({ error: 'No unified pricing' }, { status: 422 })
  }
  const womensProductId = unifiedPricing.productIdWomens
  const structuralColor = typeof draft.structural_color === 'string'
    ? draft.structural_color.trim().toLowerCase()
    : 'white'

  // ── Fetch womens variants and pick one ───────────────────────────────────
  const pfHeaders: HeadersInit = {
    Authorization: `Bearer ${printfulApiKey}`,
    'Content-Type': 'application/json',
    'X-PF-Store-Id': storeId,
  }

  let womensVariantId: number | null = null
  try {
    const varRes = await fetch(`${PRINTFUL_BASE}/products/${womensProductId}`, { headers: pfHeaders })
    if (varRes.ok) {
      const varData = await varRes.json() as {
        result?: { variants?: Array<{ id: number; color?: string; size?: string }> }
      }
      const all = varData.result?.variants ?? []
      const colorFiltered = all.filter((v) => (v.color ?? '').toLowerCase().includes(structuralColor))
      const source = colorFiltered.length > 0 ? colorFiltered : all
      womensVariantId = source[0]?.id ?? null
    }
  } catch (e) {
    console.error('[generate-womens-mockups] variant fetch failed', e)
  }

  if (!womensVariantId) {
    console.error('[generate-womens-mockups] could not resolve womens variant', { womensProductId, structuralColor })
    return NextResponse.json({ error: 'Could not resolve womens variant' }, { status: 422 })
  }

  // ── Parse design state ────────────────────────────────────────────────────
  const designState = draft.design_state && typeof draft.design_state === 'object'
    ? (draft.design_state as Record<string, unknown>)
    : {}

  const globalPatternPath = typeof draft.pattern_image_url === 'string'
    ? draft.pattern_image_url.trim()
    : ''

  const perPlacementPaths = parsePlacementImages(designState)
  const hasPerPlacementImages = Object.keys(perPlacementPaths).length > 0

  if (!globalPatternPath && !hasPerPlacementImages) {
    return NextResponse.json({ error: 'No design image on draft' }, { status: 400 })
  }

  const placementTransforms = parsePrintfulPlacements(designState)

  // ── Sign storage paths ────────────────────────────────────────────────────
  const pathsToSign = new Set<string>()
  if (globalPatternPath) pathsToSign.add(globalPatternPath)
  for (const layers of Object.values(perPlacementPaths)) {
    for (const layer of layers) {
      if (isImageLayer(layer)) pathsToSign.add(layer.path)
    }
  }

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(Array.from(pathsToSign), SIGNED_URL_FOR_PRINTFUL_SEC)

  if (signError || !signed) {
    console.error('[generate-womens-mockups] sign error', signError?.message)
    return NextResponse.json({ error: 'Could not sign image URLs' }, { status: 500 })
  }

  const pathsSigned = Array.from(pathsToSign)
  const signedByPath = new Map<string, string>()
  for (let i = 0; i < pathsSigned.length; i++) {
    const entry = signed[i]
    const url = entry?.signedUrl?.trim()
    if (!url) continue
    signedByPath.set(pathsSigned[i], url)
    if (entry.path?.trim() && entry.path.trim() !== pathsSigned[i]) {
      signedByPath.set(entry.path.trim(), url)
    }
  }

  const defaultImageUrl = globalPatternPath ? signedByPath.get(globalPatternPath) : undefined

  // ── Fetch printfiles data for womens product ──────────────────────────────
  const [productRes, printfilesRes] = await Promise.all([
    fetch(`${PRINTFUL_BASE}/products/${womensProductId}`, { headers: pfHeaders }),
    fetch(`${PRINTFUL_BASE}/mockup-generator/printfiles/${womensProductId}`, { headers: pfHeaders }),
  ])

  if (!productRes.ok || !printfilesRes.ok) {
    console.error('[generate-womens-mockups] Printful product/printfiles fetch failed', {
      productStatus: productRes.status,
      printfilesStatus: printfilesRes.status,
    })
    return NextResponse.json({ error: 'Failed to load Printful product data' }, { status: 502 })
  }

  const productData = (await productRes.json()) as {
    result?: { variants?: Array<{ id: number }> }
  }
  const printfilesData = (await printfilesRes.json()) as {
    result?: PrintfulPrintfilesResult
  }

  const variants = productData.result?.variants ?? []
  const variantIds = new Set(variants.map((v) => v.id))
  if (!variantIds.has(womensVariantId)) {
    console.error('[generate-womens-mockups] womens variant not in product', { womensVariantId, womensProductId })
    return NextResponse.json({ error: 'Variant does not belong to womens product' }, { status: 400 })
  }

  const printfilesResult = printfilesData.result ?? {}
  const availablePlacements = printfilesResult.available_placements ?? {}
  const { placementKeys, variantMapping } = resolvePlacementKeys(printfilesResult, womensVariantId)

  if (!variantMapping || placementKeys.length === 0) {
    console.warn('[generate-womens-mockups] no placement keys for variant', womensVariantId)
    return NextResponse.json({ skipped: true, reason: 'no_placements' })
  }

  const printfileById = buildPrintfileById(printfilesResult)

  // ── Route per-placement images (direct vs composite) ─────────────────────
  const imageUrlByPlacement: Record<string, string> = {}
  const placementTransformOverrides: Record<string, PlacementCompactTransform> = {}

  for (const [placement, layers] of Object.entries(perPlacementPaths)) {
    if (isFixedBrandingPlacement(placement)) continue
    const imageLayers = layers.filter(isImageLayer)
    if (!placementLayersNeedServerComposite(layers) && imageLayers.length === 1) {
      const url = signedByPath.get(imageLayers[0].path)
      if (url) {
        imageUrlByPlacement[placement] = url
        placementTransformOverrides[placement] = {
          s: imageLayers[0].s,
          dx: imageLayers[0].dx,
          dy: imageLayers[0].dy,
        }
      }
    } else if (layers.length > 0) {
      imageUrlByPlacement[`__pending__${placement}`] = placement
    }
  }

  const placementTransformOverridesEnriched = enrichDirectImagePlacementOverrides(
    placementTransformOverrides,
    perPlacementPaths,
    (placement) => {
      const printfileId = variantMapping?.placements[placement]
      const pf = printfileId != null ? printfileById.get(printfileId) : null
      return { width: pf?.width ?? 1800, height: pf?.height ?? 1800 }
    }
  )

  // Resolve composited placements.
  const pendingPlacements = Object.keys(imageUrlByPlacement)
    .filter((k) => k.startsWith('__pending__'))
    .map((k) => k.slice('__pending__'.length))

  if (pendingPlacements.length > 0) {
    await Promise.all(
      pendingPlacements.map(async (placement) => {
        delete imageUrlByPlacement[`__pending__${placement}`]
        const layers = perPlacementPaths[placement]
        if (!layers?.length) return

        const printfileId = variantMapping?.placements[placement]
        const pf = printfileId != null ? printfileById.get(printfileId) : null
        const areaWidth = pf?.width ?? 1800
        const areaHeight = pf?.height ?? 1800

        const layerInputs = placementLayersToCompositeInputs(layers, signedByPath, areaWidth, areaHeight)
        if (layerInputs.length === 0) return

        try {
          const compositedBuffer = await compositeLayersToBuffer(areaWidth, areaHeight, layerInputs)
          const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])
          if (compositedBuffer.length < 8 || !compositedBuffer.subarray(0, 4).equals(PNG_MAGIC)) {
            throw new Error('Canvas produced invalid PNG')
          }
          const compositePath = `${authUserId}/${draftId}/composites/womens-${placement}-${Date.now()}.png`
          const { error: uploadErr } = await admin.storage
            .from(BUCKET)
            .upload(compositePath, compositedBuffer, { contentType: 'image/png', upsert: true })
          if (uploadErr) {
            console.error('[generate-womens-mockups] composite upload failed', placement, uploadErr.message)
            return
          }
          const { data: compositeSigned } = await admin.storage
            .from(BUCKET)
            .createSignedUrls([compositePath], SIGNED_URL_FOR_PRINTFUL_SEC)
          const compositeUrl = compositeSigned?.[0]?.signedUrl
          if (compositeUrl) {
            imageUrlByPlacement[placement] = compositeUrl
            placementTransformOverridesEnriched[placement] = { s: 1, dx: 0, dy: 0 }
          }
        } catch (err) {
          console.error('[generate-womens-mockups] composite render failed', placement, err)
        }
      })
    )
  }

  // Resolve branding URL.
  const fixedBrandingImageUrl = await resolveFixedBrandingUrlForPrintful(admin)

  const files = buildMockupFileEntries({
    placementKeys,
    variantMapping,
    printfileById,
    imageUrlByPlacement,
    defaultImageUrl,
    placementTransforms: { ...placementTransforms, ...placementTransformOverridesEnriched },
    fixedBrandingImageUrl,
  })

  if (files.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no_files' })
  }

  // ── Acquire mockup slot ───────────────────────────────────────────────────
  const slotHolder = crypto.randomUUID()
  const slot = await tryAcquirePrintfulMockupSlot(admin, slotHolder)
  if (slot === 'busy') {
    console.warn('[generate-womens-mockups] slot busy — skipping for now', draftId)
    return NextResponse.json({ skipped: true, reason: 'slot_busy' })
  }

  // ── Run Printful mockup task ──────────────────────────────────────────────
  let batch: Awaited<ReturnType<typeof createTaskAndPoll>>
  try {
    batch = await createTaskAndPoll(womensProductId, womensVariantId, files, pfHeaders)
  } finally {
    if (slot === 'granted') {
      await releasePrintfulMockupSlot(admin, slotHolder)
    }
  }

  if (!batch.ok) {
    console.error('[generate-womens-mockups] Printful task failed', {
      draftId,
      womensProductId,
      womensVariantId,
      reason: batch.reason,
    })
    return NextResponse.json({ error: 'Printful task failed', reason: batch.reason }, { status: 502 })
  }

  // ── Build placement list tagged as womens ─────────────────────────────────
  const urlByPlacement = new Map<string, string>()
  for (const m of batch.mockups) {
    const url = (m.mockup_url ?? '').trim()
    if (url && !urlByPlacement.has(m.placement)) {
      urlByPlacement.set(m.placement, url)
    }
  }

  const womensPlacements: StoredMockupPlacement[] = placementKeys.map((placement) => ({
    placement,
    label: availablePlacements[placement] ?? placement,
    mockup_url: urlByPlacement.get(placement) ?? '',
    gender: 'womens' as const,
  })).filter((p) => p.mockup_url)

  if (womensPlacements.length === 0) {
    console.warn('[generate-womens-mockups] no mockup URLs from Printful', draftId)
    return NextResponse.json({ skipped: true, reason: 'no_urls' })
  }

  // ── Persist to storage in 'womens' subdir ────────────────────────────────
  const storedWomens = await persistPrintfulMockupsToStorage(
    admin,
    authUserId,
    draftId,
    womensPlacements,
    { storageSubdir: 'womens' }
  )

  const hasStoredPath = storedWomens.some(
    (p) => p.mockup_path?.trim() || (p.extra_mockups ?? []).some((e) => e.mockup_path?.trim())
  )

  if (!hasStoredPath) {
    console.warn('[generate-womens-mockups] storage upload failed for all placements', draftId)
    return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
  }

  // Ensure gender tag is preserved in the db payload.
  const womensDbPlacements = mockupPlacementsForDatabase(storedWomens).map((p) => ({
    ...p,
    gender: 'womens' as const,
  }))

  // ── Re-read draft and merge ───────────────────────────────────────────────
  // Re-read in case mockup_urls was updated between our original load and now.
  const { data: latestDraft } = await admin
    .from('design_draft')
    .select('mockup_urls')
    .eq('id', draftId)
    .maybeSingle()

  const latestMockups = (Array.isArray(latestDraft?.mockup_urls)
    ? latestDraft!.mockup_urls
    : []) as StoredMockupPlacement[]

  // Keep any existing entries (mens + anything else), append womens.
  const alreadyHasWomens = latestMockups.some((p) => p.gender === 'womens')
  if (alreadyHasWomens) {
    // Another concurrent call beat us — skip to avoid duplicating.
    return NextResponse.json({ skipped: true, reason: 'already_generated_concurrent' })
  }

  const merged = [...latestMockups, ...womensDbPlacements]

  const { error: updateError } = await admin
    .from('design_draft')
    .update({ mockup_urls: merged })
    .eq('id', draftId)

  if (updateError) {
    console.error('[generate-womens-mockups] mockup_urls update failed', updateError.message)
    return NextResponse.json({ error: 'Failed to save mockups' }, { status: 500 })
  }

  console.log('[generate-womens-mockups] done', { draftId, womensPlacementCount: womensDbPlacements.length })
  return NextResponse.json({ ok: true, placementCount: womensDbPlacements.length })
}
