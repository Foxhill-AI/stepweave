import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parsePrintfulPlacements, parsePlacementImages } from '@/lib/designDraftState'
import {
  createTaskAndPoll,
  mergeMockups,
  PRINTFUL_BASE,
  type PrintfulPrintfilesResult,
} from '@/lib/printful/mockupTask'
import {
  buildMockupFileEntries,
  buildPrintfileById,
  resolvePlacementKeys,
} from '@/lib/printful/buildMockupFiles'
import { compositeLayersToBuffer } from '@/lib/printful/compositeImages'

const BUCKET = 'design-patterns'
/** Long enough for Printful to fetch the pattern image during mockup generation */
const SIGNED_URL_FOR_PRINTFUL_SEC = 7200

export type PreviewMockupExtra = {
  title: string
  mockup_url: string
}

export type PreviewMockupPlacement = {
  placement: string
  label: string
  mockup_url: string
  extra_mockups?: PreviewMockupExtra[]
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
    .select('id, user_account_id, base_model_id, pattern_image_url, design_state')
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

  // Collect all unique paths that need to be signed
  const pathsToSign = new Set<string>()
  if (globalPatternPath) pathsToSign.add(globalPatternPath)
  for (const layers of Object.values(perPlacementPaths)) {
    for (const layer of layers) pathsToSign.add(layer.path)
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
  // Single-layer placements use the signed URL directly (Printful positions it via `position`).
  // Multi-layer placements are composited into one image pre-positioned at the printfile canvas.
  const imageUrlByPlacement: Record<string, string> = {}
  // Overrides for placement transforms: single-layer uses layer's own s/dx/dy;
  // multi-layer will use { s:1, dx:0, dy:0 } (image is pre-positioned after compositing).
  const placementTransformOverrides: Record<string, { s: number; dx: number; dy: number }> = {}

  for (const [placement, layers] of Object.entries(perPlacementPaths)) {
    if (layers.length === 1) {
      const url = signedByPath.get(layers[0].path)
      if (url) {
        imageUrlByPlacement[placement] = url
        placementTransformOverrides[placement] = { s: layers[0].s, dx: layers[0].dx, dy: layers[0].dy }
      }
    } else if (layers.length > 1) {
      // Will be resolved after printfiles data is available
      imageUrlByPlacement[`__pending__${placement}`] = placement
    }
  }

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

  if (!variantMapping || placementKeys.length === 0) {
    return NextResponse.json({
      product_id: productId,
      variant_id: variantId,
      placements: [] as PreviewMockupPlacement[],
      mockup_generation_unavailable: true,
    })
  }

  const printfileById = buildPrintfileById(printfilesResult)

  // Resolve multi-layer placements: composite layers → upload → sign
  const pendingPlacements = Object.keys(imageUrlByPlacement)
    .filter((k) => k.startsWith('__pending__'))
    .map((k) => k.slice('__pending__'.length))

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

        // Resolve signed URLs for each layer
        const layerInputs = layers.flatMap((l) => {
          const url = signedByPath.get(l.path)
          return url ? [{ signedUrl: url, s: l.s, dx: l.dx, dy: l.dy }] : []
        })
        if (layerInputs.length === 0) return

        try {
          const compositedBuffer = await compositeLayersToBuffer(areaWidth, areaHeight, layerInputs)
          const compositePath = `${authUserId}/${draftId}/composites/${placement}-${Date.now()}.png`
          const { error: uploadErr } = await admin.storage
            .from(BUCKET)
            .upload(compositePath, compositedBuffer, { contentType: 'image/png', upsert: true })
          if (uploadErr) {
            console.error('[preview-mockups] composite upload', uploadErr.message)
            return
          }
          const { data: compositeSigned } = await admin.storage
            .from(BUCKET)
            .createSignedUrls([compositePath], SIGNED_URL_FOR_PRINTFUL_SEC)
          const compositeUrl = compositeSigned?.[0]?.signedUrl
          if (compositeUrl) imageUrlByPlacement[placement] = compositeUrl
        } catch (err) {
          console.error('[preview-mockups] composite error', err)
        }
      })
    )
  }

  // Build final transform map:
  // - Multi-layer composited placements → full-canvas (s:1, dx:0, dy:0)
  // - Single-layer per-placement → layer's own transform
  // - Global-fallback placements → printful_placements (unchanged)
  const finalTransforms = { ...placementTransforms }
  for (const placement of pendingPlacements) {
    if (imageUrlByPlacement[placement]) {
      finalTransforms[placement] = { s: 1, dx: 0, dy: 0 }
    }
  }
  for (const [placement, t] of Object.entries(placementTransformOverrides)) {
    finalTransforms[placement] = t
  }

  const files = buildMockupFileEntries({
    placementKeys,
    variantMapping,
    printfileById,
    imageUrlByPlacement,
    defaultImageUrl,
    placementTransforms: finalTransforms,
  })

  if (files.length === 0) {
    return NextResponse.json({
      product_id: productId,
      variant_id: variantId,
      placements: [] as PreviewMockupPlacement[],
      mockup_generation_unavailable: true,
    })
  }

  const batch = await createTaskAndPoll(productId, variantId, files, headers)
  const urlByPlacement = new Map<string, string>()
  const extrasByPlacement = new Map<string, PreviewMockupExtra[]>()
  let mockupErrorReason: string | undefined

  if (batch.ok) {
    mergeMockups(urlByPlacement, batch.mockups)
    for (const m of batch.mockups) {
      const extras: PreviewMockupExtra[] = (m.extra_mockups ?? [])
        .filter((e) => e.mockup_url?.trim())
        .map((e) => ({ title: e.title ?? '', mockup_url: e.mockup_url! }))
      if (extras.length) extrasByPlacement.set(m.placement, extras)
    }
  } else {
    mockupErrorReason = batch.reason
    console.error('[preview-mockups] Printful task failed —', {
      reason: batch.reason,
      status: 'status' in batch ? batch.status : undefined,
      productId,
      variantId,
      placements: files.map((f) => f.placement),
      files,
    })
  }

  const placements: PreviewMockupPlacement[] = placementKeys.map((placement) => {
    const extras = extrasByPlacement.get(placement)
    return {
      placement,
      label: availablePlacements[placement] ?? placement,
      mockup_url: urlByPlacement.get(placement) ?? '',
      ...(extras ? { extra_mockups: extras } : {}),
    }
  })

  const anyUrl = placements.some((p) => p.mockup_url)

  return NextResponse.json({
    product_id: productId,
    variant_id: variantId,
    placements,
    mockup_generation_unavailable: !anyUrl,
    ...(mockupErrorReason ? { mockup_error: mockupErrorReason } : {}),
  })
}
