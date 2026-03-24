import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parsePrintfulPlacements } from '@/lib/designDraftState'
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

const BUCKET = 'design-patterns'
/** Long enough for Printful to fetch the pattern image during mockup generation */
const SIGNED_URL_FOR_PRINTFUL_SEC = 7200

export type PreviewMockupPlacement = {
  placement: string
  label: string
  mockup_url: string
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

  const patternPath =
    typeof draft.pattern_image_url === 'string' ? draft.pattern_image_url.trim() : ''
  if (!patternPath) {
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
  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrls([patternPath], SIGNED_URL_FOR_PRINTFUL_SEC)

  if (signError || !signed?.length || !signed[0]?.signedUrl) {
    console.error('[preview-mockups] sign', signError?.message)
    return NextResponse.json({ error: 'Could not sign pattern image URL' }, { status: 500 })
  }

  const imageUrl = signed[0].signedUrl

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
  const files = buildMockupFileEntries({
    placementKeys,
    variantMapping,
    printfileById,
    imageUrl,
    placementTransforms,
  })

  const batch = await createTaskAndPoll(productId, variantId, files, headers)
  const urlByPlacement = new Map<string, string>()
  let mockupErrorReason: string | undefined
  if (batch.ok) {
    mergeMockups(urlByPlacement, batch.mockups)
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

  const placements: PreviewMockupPlacement[] = placementKeys.map((placement) => ({
    placement,
    label: availablePlacements[placement] ?? placement,
    mockup_url: urlByPlacement.get(placement) ?? '',
  }))

  const anyUrl = placements.some((p) => p.mockup_url)

  return NextResponse.json({
    product_id: productId,
    variant_id: variantId,
    placements,
    mockup_generation_unavailable: !anyUrl,
    ...(mockupErrorReason ? { mockup_error: mockupErrorReason } : {}),
  })
}
