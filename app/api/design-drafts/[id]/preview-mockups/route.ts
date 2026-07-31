import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createServerSupabaseClient } from '@/lib/supabase/server'
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
  mergeMockups,
  PRINTFUL_BASE,
  type MockupResult,
  type PrintfulPrintfilesResult,
  type CreateMockupTaskOptions,
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
  PRINTFUL_SLOT_BUSY_CODE,
  tryAcquirePrintfulMockupSlot,
  releasePrintfulMockupSlot,
} from '@/lib/printful/mockupSlot'
import {
  mockupPlacementsForDatabase,
  persistPrintfulMockupsToStorage,
  resolveMockupPlacementsForDisplay,
  type StoredMockupPlacement,
} from '@/lib/productMockups/storage'
import { viewHintFromPrintfulUrl } from '@/lib/productMockups/canonicalViews'

/** Extend Vercel serverless function timeout to 300s (Vercel Pro max).
 * Default is 60s which is too short for Printful's mockup polling. */
export const maxDuration = 300

const BUCKET = 'design-patterns'

// ── In-process branding URL cache ──────────────────────────────────────────────
// The Step Weave mark URL is stable between deploys. Cache it per function instance
// to avoid a HEAD request (or full Printful file-library round-trip) on every preview call.
let _brandingUrlCache: string | null = null
let _brandingUrlCacheExpiresAt = 0
const BRANDING_CACHE_TTL_MS = 23 * 60 * 60 * 1000 // 23 hours

async function getCachedBrandingUrl(
  admin: Parameters<typeof resolveFixedBrandingUrlForPrintful>[0]
): Promise<string | null> {
  if (_brandingUrlCache && Date.now() < _brandingUrlCacheExpiresAt) {
    return _brandingUrlCache
  }
  const url = await resolveFixedBrandingUrlForPrintful(admin)
  if (url) {
    _brandingUrlCache = url
    _brandingUrlCacheExpiresAt = Date.now() + BRANDING_CACHE_TTL_MS
  }
  return url
}
/** Long enough for Printful to fetch the pattern image during mockup generation */
const SIGNED_URL_FOR_PRINTFUL_SEC = 7200

export type PreviewMockupExtra = {
  title: string
  mockup_url: string
  /** Canonical camera view ('top' | 'left' | 'right' | 'back' | 'front') */
  view?: string
}

export type PreviewMockupPlacement = {
  placement: string
  label: string
  mockup_url: string
  view?: string
  extra_mockups?: PreviewMockupExtra[]
}

/**
 * Standard gallery views and the Printful `options` names that render them.
 * The default task usually renders only Left/Right/Front; whatever is missing
 * afterwards is requested in a second task so every product gets as close to
 * Top/Left/Right/Back as Printful supports.
 */
const VIEW_OPTION_CANDIDATES: Array<{ view: string; names: string[] }> = [
  { view: 'top', names: ['Front 2', 'Top'] },
  { view: 'left', names: ['Left', 'Left Front'] },
  { view: 'right', names: ['Right', 'Right Front'] },
  { view: 'back', names: ['Back'] },
]

/**
 * Athletic shoes (shoe_left / shoe_right layout) ignore `options` camera filters and
 * return 400. Verified on product 658: mockup styles via `option_groups` instead.
 */
const ATHLETIC_VIEW_OPTION_GROUPS: Array<{ view: string; groups: string[] }> = [
  { view: 'left', groups: ['Lifestyle 2', 'Flat 2'] },
  { view: 'right', groups: ['Flat Lifestyle'] },
  { view: 'back', groups: ['Flat 3', 'Flat 6'] },
]

function isAthleticShoeLayout(placementKeys: string[]): boolean {
  const keys = new Set(placementKeys)
  return (
    keys.has('shoe_left') &&
    keys.has('shoe_right') &&
    !placementKeys.some((k) => k.includes('quarter'))
  )
}

/**
 * POST /api/design-drafts/[id]/preview-mockups
 * Generates Printful mockups using the draft's pattern image + design_state.printful_placements.
 * Requires auth and draft ownership.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const draftId = Number(id)
  if (Number.isNaN(draftId)) {
    return NextResponse.json({ error: 'Invalid draft id' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: draft, error: draftError } = await supabase
    .from('design_draft')
    .select('id, user_account_id, base_model_id, pattern_image_url, design_state, mockup_urls')
    .eq('id', draftId)
    .maybeSingle()

  if (draftError || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  const { data: userAccount } = await supabase
    .from('user_account')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()

  if (!userAccount || (draft.user_account_id as number) !== userAccount.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const globalPatternPath =
    typeof draft.pattern_image_url === 'string' ? draft.pattern_image_url.trim() : ''

  const perPlacementPaths = parsePlacementImages(
    draft.design_state && typeof draft.design_state === 'object' ? draft.design_state : {}
  )
  const hasPerPlacementImages = Object.keys(perPlacementPaths).length > 0

  if (!globalPatternPath && !hasPerPlacementImages) {
    return NextResponse.json(
      { error: 'Upload or generate a pattern image before requesting a product preview.' },
      { status: 400 }
    )
  }

  const productId = String(draft.base_model_id ?? '').trim()
  if (!productId) {
    return NextResponse.json({ error: 'Draft has no base model' }, { status: 400 })
  }

  const designState =
    draft.design_state && typeof draft.design_state === 'object'
      ? (draft.design_state as Record<string, unknown>)
      : {}

  let variantId: number | null = null
  const vidRaw = designState.printful_variant_id
  if (typeof vidRaw === 'number' && Number.isFinite(vidRaw)) variantId = vidRaw
  else if (typeof vidRaw === 'string' && /^\d+$/.test(vidRaw)) variantId = parseInt(vidRaw, 10)

  if (variantId == null) {
    return NextResponse.json(
      { error: 'Select a Printful variant (color/size) before preview.' },
      { status: 400 }
    )
  }

  // ── Cache check ──────────────────────────────────────────────────────────────
  // Hash the inputs that affect mockup output. If unchanged since last generation,
  // serve stored mockups immediately without touching Printful.
  const inputHashSource = JSON.stringify({
    v: variantId,
    p: (designState.pattern_images ?? null),
    t: (designState.printful_placements ?? null),
    g: globalPatternPath || null,
    // Bump when fixed branding asset changes so cached mockups refresh.
    b: 'branding-rect-stacked-v1',
  })
  const inputHash = createHash('sha256').update(inputHashSource).digest('hex').slice(0, 16)

  const storedHash = typeof designState._mockup_input_hash === 'string'
    ? designState._mockup_input_hash
    : null
  const storedMockups = Array.isArray(draft.mockup_urls) && draft.mockup_urls.length > 0
    ? (draft.mockup_urls as StoredMockupPlacement[])
    : null

  if (storedHash === inputHash && storedMockups) {
    console.log('[preview-mockups] cache hit — serving stored mockups', { draftId, inputHash })
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceRoleKey) {
      const admin = createClient(supabaseUrl, serviceRoleKey)
      const resolved = await resolveMockupPlacementsForDisplay(admin, storedMockups)
      const anyUrl = resolved.some((p) => p.mockup_url)
      if (anyUrl) {
        return NextResponse.json({
          product_id: productId,
          variant_id: variantId,
          placements: resolved.map((p) => ({
            placement: p.placement,
            label: p.label,
            mockup_url: p.mockup_url,
            ...(p.view ? { view: p.view } : {}),
            ...(p.extra_mockups?.length ? { extra_mockups: p.extra_mockups } : {}),
          })),
          mockups_persisted: true,
          from_cache: true,
        })
      }
    }
  }

  console.log('[preview-mockups]', {
    draftId,
    productId,
    variantId,
    globalPatternPath: globalPatternPath || null,
    patternImagePlacements: Object.keys(perPlacementPaths),
  })

  const placementTransforms = parsePrintfulPlacements(designState)

  const apiKey = process.env.PRINTFUL_API_KEY
  const storeId = process.env.PRINTFUL_STORE_ID?.trim()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!apiKey?.trim() || !storeId) {
    return NextResponse.json({ error: 'Printful not configured' }, { status: 503 })
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  // Fire branding URL resolution immediately so it can run in parallel with compositing below.
  const brandingUrlPromise = getCachedBrandingUrl(admin)

  // Collect all unique paths that need to be signed (image layers only — text layers have no path)
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
    console.error('[preview-mockups] sign', signError?.message)
    return NextResponse.json({ error: 'Could not sign pattern image URL' }, { status: 500 })
  }

  const signedByPath = new Map<string, string>()
  for (const entry of signed) {
    if (entry.signedUrl && entry.path) signedByPath.set(entry.path, entry.signedUrl)
  }

  const defaultImageUrl = globalPatternPath ? signedByPath.get(globalPatternPath) : undefined

  // Build per-placement image URLs.
  // Single image-only layers use the signed URL directly (Printful positions it via `position`).
  // Any placement with text layers or multiple layers must be composited server-side.
  const imageUrlByPlacement: Record<string, string> = {}
  // Overrides for placement transforms: single-layer uses layer's own s/dx/dy;
  // composited placements use { s:1, dx:0, dy:0 } (image is pre-positioned).
  const placementTransformOverrides: Record<string, PlacementCompactTransform> = {}

  for (const [placement, layers] of Object.entries(perPlacementPaths)) {
    // Step Weave mark is forced in buildMockupFileEntries — ignore draft layers here.
    if (isFixedBrandingPlacement(placement)) continue
    const imageLayers = layers.filter(isImageLayer)
    if (!placementLayersNeedServerComposite(layers) && imageLayers.length === 1) {
      // Single raster, no text, no rotation — Printful positions the raw URL
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
      // Mixed or multi-layer — will be composited after printfiles data is available
      imageUrlByPlacement[`__pending__${placement}`] = placement
    }
  }

  console.log(
    '[preview-mockups] routing',
    Object.entries(perPlacementPaths).map(([p, layers]) => ({
      placement: p,
      hasText: layers.some(isTextLayer),
      nImages: layers.filter(isImageLayer).length,
      mode: imageUrlByPlacement[`__pending__${p}`]
        ? 'pending_composite'
        : imageUrlByPlacement[p]
          ? 'direct_image'
          : 'none',
    }))
  )

  const headers: HeadersInit = {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    'X-PF-Store-Id': storeId,
  }

  const [productRes, printfilesRes] = await Promise.all([
    fetch(`${PRINTFUL_BASE}/products/${productId}`, { headers }),
    fetch(`${PRINTFUL_BASE}/mockup-generator/printfiles/${productId}`, { headers }),
  ])

  if (!productRes.ok || !printfilesRes.ok) {
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
  if (!variantIds.has(variantId)) {
    return NextResponse.json({ error: 'Stored variant does not belong to this product' }, { status: 400 })
  }

  const printfilesResult = printfilesData.result ?? {}
  const availablePlacements = printfilesResult.available_placements ?? {}
  const { placementKeys, variantMapping } = resolvePlacementKeys(printfilesResult, variantId)

  const designPlacementKeys = Object.keys(perPlacementPaths)
  const missingOnPrintful = designPlacementKeys.filter((k) => !placementKeys.includes(k))
  const missingInDesign = placementKeys.filter((k) => !designPlacementKeys.includes(k))
  console.log('[preview-mockups] placement alignment', {
    placementKeys,
    designPlacementKeys,
    missingOnPrintful,
    missingInDesign,
    variantHasMapping: Boolean(variantMapping?.placements),
  })

  if (!variantMapping || placementKeys.length === 0) {
    return NextResponse.json({
      product_id: productId,
      variant_id: variantId,
      placements: [] as PreviewMockupPlacement[],
      mockup_generation_unavailable: true,
    })
  }

  const printfileById = buildPrintfileById(printfilesResult)

  // Reroute direct-image placements that would be cropped by Printful's position API.
  // Printful's position does not support images larger than the print area or negative
  // offsets — it clamps or ignores overflow, producing a random-looking crop. These
  // must go through the server-side composite which clips naturally.
  // We keep the original URL as a fallback in __fallback__<placement> so that if the
  // composite render fails (e.g. canvas binary not available), Printful still gets a
  // valid image (with clamped crop rather than failing the whole task).
  const fallbackUrlByPlacement: Record<string, string> = {}
  const fallbackTransformByPlacement: Record<string, PlacementCompactTransform> = {}
  for (const [placement, t] of Object.entries(placementTransformOverrides)) {
    const printfileId = variantMapping?.placements[placement]
    const pf = printfileId != null ? printfileById.get(printfileId) : null
    const areaWidth = pf?.width ?? 1800
    const areaHeight = pf?.height ?? 1800
    const layers = perPlacementPaths[placement]
    const imgs = layers?.filter(isImageLayer) ?? []
    if (imgs.length !== 1) continue
    const layer = imgs[0]
    const iw = typeof layer.w === 'number' && layer.w > 0 ? layer.w : areaWidth * Math.min(1, Math.max(0.05, layer.s))
    const ih = typeof layer.h === 'number' && layer.h > 0 ? layer.h : areaHeight * Math.min(1, Math.max(0.05, layer.s))
    const left = (areaWidth - iw) / 2 + (t.dx ?? layer.dx)
    const top = (areaHeight - ih) / 2 + (t.dy ?? layer.dy)
    const wouldCrop = left < 0 || top < 0 || left + iw > areaWidth || top + ih > areaHeight
    if (wouldCrop) {
      console.log('[preview-mockups] rerouting cropped direct-image to composite', {
        placement, areaWidth, areaHeight, iw, ih, left, top,
      })
      // Save original for fallback
      fallbackUrlByPlacement[placement] = imageUrlByPlacement[placement]
      fallbackTransformByPlacement[placement] = t
      delete imageUrlByPlacement[placement]
      delete placementTransformOverrides[placement]
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

  // Resolve multi-layer placements: composite layers → upload → sign
  const pendingPlacements = Object.keys(imageUrlByPlacement)
    .filter((k) => k.startsWith('__pending__'))
    .map((k) => k.slice('__pending__'.length))

  /** Placements that fell back to direct image (composite failed) — need enriched transform, not full-canvas */
  const compositeFallbackPlacements = new Set<string>()

  if (pendingPlacements.length > 0) {
    const authUserId = authUser.id
    await Promise.all(
      pendingPlacements.map(async (placement) => {
        delete imageUrlByPlacement[`__pending__${placement}`]
        const layers = perPlacementPaths[placement]
        if (!layers?.length) return

        // Get printfile dimensions for this placement
        const printfileId = variantMapping?.placements[placement]
        const pf = printfileId != null ? printfileById.get(printfileId) : null
        const areaWidth = pf?.width ?? 1800
        const areaHeight = pf?.height ?? 1800

        const layerInputs = placementLayersToCompositeInputs(
          layers,
          signedByPath,
          areaWidth,
          areaHeight
        )
        if (layerInputs.length === 0) return

        try {
          const compositedBuffer = await compositeLayersToBuffer(areaWidth, areaHeight, layerInputs)
          // Validate PNG magic bytes — if canvas binary on the server is wrong it may
          // silently produce garbage bytes that pass upload but cause Printful "Internal Server Error"
          const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])
          if (compositedBuffer.length < 8 || !compositedBuffer.subarray(0, 4).equals(PNG_MAGIC)) {
            throw new Error(`Canvas produced invalid PNG (${compositedBuffer.length} bytes, magic: ${compositedBuffer.subarray(0, 4).toString('hex')})`)
          }
          const compositePath = `${authUserId}/${draftId}/composites/${placement}-${Date.now()}.png`
          const { error: uploadErr } = await admin.storage
            .from(BUCKET)
            .upload(compositePath, compositedBuffer, { contentType: 'image/png', upsert: true })
          if (uploadErr) {
            console.error('[preview-mockups] composite upload failed for', placement, uploadErr.message)
            // Fall back to direct URL (wrong crop, but Printful task succeeds)
            if (fallbackUrlByPlacement[placement]) {
              imageUrlByPlacement[placement] = fallbackUrlByPlacement[placement]
              compositeFallbackPlacements.add(placement)
              console.warn('[preview-mockups] using fallback direct URL for', placement)
            }
            return
          }
          const { data: compositeSigned } = await admin.storage
            .from(BUCKET)
            .createSignedUrls([compositePath], SIGNED_URL_FOR_PRINTFUL_SEC)
          const compositeUrl = compositeSigned?.[0]?.signedUrl
          if (compositeUrl) {
            imageUrlByPlacement[placement] = compositeUrl
            console.log('[preview-mockups] composite ready for', placement, 'layers:', layerInputs.length)
          } else if (fallbackUrlByPlacement[placement]) {
            imageUrlByPlacement[placement] = fallbackUrlByPlacement[placement]
            compositeFallbackPlacements.add(placement)
            console.warn('[preview-mockups] composite sign failed, using fallback direct URL for', placement)
          }
        } catch (err) {
          console.error('[preview-mockups] composite render failed for', placement, err)
          // Fall back to direct URL so Printful task does not fail entirely
          if (fallbackUrlByPlacement[placement]) {
            imageUrlByPlacement[placement] = fallbackUrlByPlacement[placement]
            compositeFallbackPlacements.add(placement)
            console.warn('[preview-mockups] using fallback direct URL after render error for', placement)
          }
        }
      })
    )
  }

  // Build final transform map:
  // - Composited placements (success) → full-canvas (s:1, dx:0, dy:0)
  // - Fallback placements (composite failed, using direct URL) → enriched layer transform
  // - Single-layer per-placement (direct) → layer's own enriched transform
  // - Global-fallback placements → printful_placements (unchanged)
  const finalTransforms = { ...placementTransforms }
  for (const placement of pendingPlacements) {
    if (imageUrlByPlacement[placement] && !compositeFallbackPlacements.has(placement)) {
      finalTransforms[placement] = { s: 1, dx: 0, dy: 0 }
    }
  }
  // Enrich direct + fallback-direct transforms with explicit pixel dimensions
  const enrichedAfterComposite = enrichDirectImagePlacementOverrides(
    {
      ...placementTransformOverridesEnriched,
      // Add fallback placements that reverted to their original transforms
      ...Object.fromEntries(
        Array.from(compositeFallbackPlacements)
          .filter((p) => fallbackTransformByPlacement[p])
          .map((p) => [p, fallbackTransformByPlacement[p]])
      ),
    },
    perPlacementPaths,
    (placement) => {
      const printfileId = variantMapping?.placements[placement]
      const pf = printfileId != null ? printfileById.get(printfileId) : null
      return { width: pf?.width ?? 1800, height: pf?.height ?? 1800 }
    }
  )
  for (const [placement, t] of Object.entries(enrichedAfterComposite)) {
    finalTransforms[placement] = t
  }

  const files = buildMockupFileEntries({
    placementKeys,
    variantMapping,
    printfileById,
    imageUrlByPlacement,
    defaultImageUrl,
    placementTransforms: finalTransforms,
    fixedBrandingImageUrl: await brandingUrlPromise,
  })

  if (files.length === 0) {
    return NextResponse.json({
      product_id: productId,
      variant_id: variantId,
      placements: [] as PreviewMockupPlacement[],
      mockup_generation_unavailable: true,
    })
  }

  const slotHolder = crypto.randomUUID()
  const slot = await tryAcquirePrintfulMockupSlot(admin, slotHolder)
  if (slot === 'busy') {
    return NextResponse.json(
      {
        error: 'Another preview is generating. Please wait a moment and try again.',
        code: PRINTFUL_SLOT_BUSY_CODE,
        retry_after_ms: 2000,
      },
      { status: 503 }
    )
  }

  // Build extra view task specs from Printful's available options/option_groups.
  // We determine these upfront (before calling Printful) so we can submit ALL tasks
  // in parallel with the main task, eliminating a full extra Printful polling cycle.
  const athleticLayout = isAthleticShoeLayout(placementKeys)
  const productOptionGroups = printfilesResult.option_groups ?? []
  const productOptions = printfilesResult.options ?? []

  type ExtraViewSpec = { view: string; taskOptions: CreateMockupTaskOptions }
  const extraViewSpecs: ExtraViewSpec[] = []
  if (athleticLayout) {
    for (const { view, groups } of ATHLETIC_VIEW_OPTION_GROUPS) {
      const groupName = groups.find((g) => productOptionGroups.includes(g))
      if (groupName) extraViewSpecs.push({ view, taskOptions: { option_groups: [groupName] } })
    }
  } else {
    for (const { view, names } of VIEW_OPTION_CANDIDATES) {
      const optionName = names.find((n) => productOptions.includes(n))
      if (optionName) extraViewSpecs.push({ view, taskOptions: { options: [optionName] } })
    }
  }

  let batch: Awaited<ReturnType<typeof createTaskAndPoll>>
  const extraViewTasks: Array<{ requestedView: string; mockups: MockupResult[] }> = []

  try {
    // Submit main task + all extra view tasks simultaneously.
    // Previously serial: main task → wait → extra tasks (doubled total polling time).
    // Now parallel: all tasks start at once; total time = max(slowest task) not sum.
    const [mainResult, ...rawExtraResults] = await Promise.all([
      createTaskAndPoll(productId, variantId, files, headers),
      ...extraViewSpecs.map(({ view, taskOptions }) =>
        createTaskAndPoll(productId, variantId, files, headers, taskOptions)
          .then((result) => ({ view, result }))
          .catch((err: unknown) => {
            console.warn('[preview-mockups] extra view task error', { view, err: String(err) })
            return null
          })
      ),
    ])

    batch = mainResult

    if (batch.ok) {
      const presentViews = new Set<string>()
      const noteViewsFromMockups = (mockups: MockupResult[]) => {
        for (const m of mockups) {
          for (const u of [
            m.mockup_url,
            ...(m.extra_mockups ?? []).map((e: { mockup_url?: string }) => e.mockup_url),
          ]) {
            const view = u ? viewHintFromPrintfulUrl(u) : null
            if (view) presentViews.add(view)
          }
        }
      }
      noteViewsFromMockups(batch.mockups)

      if (athleticLayout && presentViews.has('front')) {
        // Gallery uses front as the top slot when no true top-down shot exists.
        presentViews.add('top')
      }

      for (const item of rawExtraResults) {
        if (!item) continue
        const { view, result } = item
        if (!result.ok) {
          console.warn('[preview-mockups] extra view task failed', { view, reason: result.reason })
          continue
        }
        noteViewsFromMockups(result.mockups)
        presentViews.add(view)
        extraViewTasks.push({ requestedView: view, mockups: result.mockups })
      }
    }
  } finally {
    if (slot === 'granted') {
      await releasePrintfulMockupSlot(admin, slotHolder)
    }
  }
  const urlByPlacement = new Map<string, string>()
  const extrasByPlacement = new Map<string, PreviewMockupExtra[]>()
  const productViewExtras: PreviewMockupExtra[] = []
  let mockupErrorReason: string | undefined
  let printfulErrorCode: number | undefined
  let printfulErrorMessage: string | undefined

  if (batch.ok) {
    mergeMockups(urlByPlacement, batch.mockups)
    // Printful repeats the same extra camera angles under every placement;
    // keep each unique image URL once so the stored gallery has no duplicates.
    const seenUrls = new Set<string>(urlByPlacement.values())
    for (const m of batch.mockups) {
      const url = (m.mockup_url ?? '').trim()
      const existing = extrasByPlacement.get(m.placement) ?? []
      // Option-group variant for the same placement → treat as extra
      if (url && m.option_group && urlByPlacement.get(m.placement) !== url && !seenUrls.has(url)) {
        existing.push({ title: m.option_group, mockup_url: url })
        seenUrls.add(url)
      }
      for (const e of m.extra_mockups ?? []) {
        const extraUrl = (e.mockup_url ?? '').trim()
        if (extraUrl && !seenUrls.has(extraUrl)) {
          existing.push({ title: e.title ?? '', mockup_url: extraUrl })
          seenUrls.add(extraUrl)
        }
      }
      if (existing.length) extrasByPlacement.set(m.placement, existing)
    }

    // Per-view tasks: whole-product angles (top / back / left / right), one URL each.
    const viewTitles: Record<string, string> = {
      top: 'Top',
      back: 'Back',
      left: 'Left',
      right: 'Right',
      front: 'Front',
    }
    for (const { requestedView, mockups } of extraViewTasks) {
      for (const m of mockups) {
        const urls = [m.mockup_url, ...(m.extra_mockups ?? []).map((e) => e.mockup_url)]
        for (const raw of urls) {
          const url = (raw ?? '').trim()
          if (!url || seenUrls.has(url)) continue
          seenUrls.add(url)
          const view = viewHintFromPrintfulUrl(url) ?? requestedView
          productViewExtras.push({
            title: viewTitles[view] ?? 'Product view',
            mockup_url: url,
            view,
          })
        }
      }
    }
  } else {
    mockupErrorReason = batch.reason
    if (!batch.ok && 'printful_error_code' in batch) {
      printfulErrorCode = batch.printful_error_code
      printfulErrorMessage = batch.printful_error
    }
    console.error('[preview-mockups] Printful task failed —', {
      reason: batch.reason,
      printful_error: printfulErrorMessage,
      printful_error_code: printfulErrorCode,
      status: 'status' in batch ? batch.status : undefined,
      productId,
      variantId,
      fileSummary: files.map((f) => ({
        placement: f.placement,
        urlPresent: f.image_url.trim().length > 0,
        urlPrefix: f.image_url.slice(0, 80),
      })),
    })
  }

  const placements: PreviewMockupPlacement[] = placementKeys.map((placement) => {
    const mainUrl = urlByPlacement.get(placement) ?? ''
    const mainView = mainUrl ? viewHintFromPrintfulUrl(mainUrl) : null
    const extras = extrasByPlacement.get(placement)?.map((ex) => {
      const exView = ex.view ?? viewHintFromPrintfulUrl(ex.mockup_url)
      return { ...ex, ...(exView ? { view: exView } : {}) }
    })
    return {
      placement,
      label: availablePlacements[placement] ?? placement,
      mockup_url: mainUrl,
      ...(mainView ? { view: mainView } : {}),
      ...(extras?.length ? { extra_mockups: extras } : {}),
    }
  })

  if (productViewExtras.length > 0) {
    placements.push({
      placement: '_product_views',
      label: 'Product views',
      mockup_url: '',
      extra_mockups: productViewExtras,
    })
  }

  const anyUrl = placements.some((p) => p.mockup_url)

  let responsePlacements: PreviewMockupPlacement[] = placements
  let mockupsPersisted = false

  if (anyUrl) {
    const stored = await persistPrintfulMockupsToStorage(
      admin,
      authUser.id,
      draftId,
      placements as StoredMockupPlacement[]
    )
    const hasStoredPath = stored.some(
      (p) =>
        p.mockup_path?.trim() ||
        (p.extra_mockups ?? []).some((e) => e.mockup_path?.trim())
    )

    if (hasStoredPath) {
      const generatedAt = new Date().toISOString()
      const dbPayload = mockupPlacementsForDatabase(stored)
      const { error: persistError } = await supabase
        .from('design_draft')
        .update({ mockup_urls: dbPayload, mockups_generated_at: generatedAt })
        .eq('id', draftId)
      if (persistError) {
        console.error('[preview-mockups] persist mockup_urls:', persistError.message)
      } else {
        mockupsPersisted = true
        // Persist input hash so the next Preview click can serve from cache
        // if the design hasn't changed. Stored in design_state to avoid a schema migration.
        void supabase
          .from('design_draft')
          .update({ design_state: { ...designState, _mockup_input_hash: inputHash } })
          .eq('id', draftId)
      }

      const resolved = await resolveMockupPlacementsForDisplay(admin, stored)
      responsePlacements = resolved.map((p) => ({
        placement: p.placement,
        label: p.label,
        mockup_url: p.mockup_url,
        ...(p.view ? { view: p.view } : {}),
        ...(p.extra_mockups?.length ? { extra_mockups: p.extra_mockups } : {}),
      }))
    } else {
      console.warn('[preview-mockups] Printful mockups generated but storage upload failed')
    }
  }

  return NextResponse.json({
    product_id: productId,
    variant_id: variantId,
    placements: responsePlacements,
    mockup_generation_unavailable: !anyUrl,
    mockups_persisted: mockupsPersisted,
    ...(mockupErrorReason ? { mockup_error: mockupErrorReason } : {}),
    ...(printfulErrorCode != null ? { printful_error_code: printfulErrorCode } : {}),
    ...(printfulErrorMessage ? { printful_error_message: printfulErrorMessage } : {}),
  })
}
