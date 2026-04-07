import type { SupabaseClient } from '@supabase/supabase-js'
import type { DesignDraftSnapshotPayload } from '@/lib/supabaseClient'
import {
  parsePrintfulPlacements,
  parsePlacementImages,
  isTextLayer,
  isImageLayer,
  type PrintfulPosition,
} from '@/lib/designDraftState'
import { PRINTFUL_BASE, type PrintfulPrintfilesResult } from '@/lib/printful/mockupTask'
import {
  buildMockupFileEntries,
  buildPrintfileById,
  resolvePlacementKeys,
} from '@/lib/printful/buildMockupFiles'
import { compositeLayersToBuffer, type CompositeInput } from '@/lib/printful/compositeImages'
import type { FileEntry } from '@/lib/printful/mockupTask'

const BUCKET = 'design-patterns'
const SIGNED_URL_FOR_PRINTFUL_SEC = 7200

/** Printful Orders API file entry (placement + URL + position). */
export type PrintfulOrderLineFile = {
  type: string
  url: string
  position: PrintfulPosition & { limit_to_print_area?: boolean }
}

function fileEntriesToOrderFiles(files: FileEntry[]): PrintfulOrderLineFile[] {
  return files.map((f) => ({
    type: f.placement,
    url: f.image_url,
    position: { ...f.position, limit_to_print_area: true },
  }))
}

/**
 * Build signed, positioned print files for a frozen design snapshot (same rules as preview-mockups).
 * Used after payment to submit a Printful order line item.
 */
export async function prepareOrderPrintFilesFromSnapshot(
  snapshot: DesignDraftSnapshotPayload,
  admin: SupabaseClient,
  /** Prefix for composite uploads in Storage, e.g. `order/123` */
  storageKeyPrefix: string
): Promise<{ ok: true; files: PrintfulOrderLineFile[] } | { ok: false; reason: string }> {
  const globalPatternPath =
    typeof snapshot.pattern_image_url === 'string' ? snapshot.pattern_image_url.trim() : ''

  const designState =
    snapshot.design_state && typeof snapshot.design_state === 'object'
      ? (snapshot.design_state as Record<string, unknown>)
      : {}

  const perPlacementPaths = parsePlacementImages(designState)
  const hasPerPlacementImages = Object.keys(perPlacementPaths).length > 0

  if (!globalPatternPath && !hasPerPlacementImages) {
    return { ok: false, reason: 'Design snapshot has no pattern or per-placement images' }
  }

  const productId = String(snapshot.base_model_id ?? '').trim()
  if (!productId) {
    return { ok: false, reason: 'Design snapshot has no base model (Printful product id)' }
  }

  let variantId: number | null = null
  const vidRaw = designState.printful_variant_id
  if (typeof vidRaw === 'number' && Number.isFinite(vidRaw)) variantId = vidRaw
  else if (typeof vidRaw === 'string' && /^\d+$/.test(vidRaw)) variantId = parseInt(vidRaw, 10)

  if (variantId == null) {
    return { ok: false, reason: 'Design snapshot has no Printful variant id' }
  }

  const placementTransforms = parsePrintfulPlacements(designState)

  const apiKey = process.env.PRINTFUL_API_KEY
  const storeId = process.env.PRINTFUL_STORE_ID?.trim()
  if (!apiKey?.trim() || !storeId) {
    return { ok: false, reason: 'Printful API not configured' }
  }

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
    return { ok: false, reason: signError?.message ?? 'Could not sign pattern URLs' }
  }

  const signedByPath = new Map<string, string>()
  for (const entry of signed) {
    if (entry.signedUrl && entry.path) signedByPath.set(entry.path, entry.signedUrl)
  }

  const defaultImageUrl = globalPatternPath ? signedByPath.get(globalPatternPath) : undefined

  const imageUrlByPlacement: Record<string, string> = {}
  const placementTransformOverrides: Record<string, { s: number; dx: number; dy: number }> = {}

  for (const [placement, layers] of Object.entries(perPlacementPaths)) {
    const hasText = layers.some(isTextLayer)
    const imageLayers = layers.filter(isImageLayer)
    if (!hasText && imageLayers.length === 1) {
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
    return { ok: false, reason: 'Failed to load Printful product or printfiles' }
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
    return { ok: false, reason: 'Stored variant does not belong to this Printful product' }
  }

  const printfilesResult = printfilesData.result ?? {}
  const { placementKeys, variantMapping } = resolvePlacementKeys(printfilesResult, variantId)

  if (!variantMapping || placementKeys.length === 0) {
    return { ok: false, reason: 'No print placements for this variant' }
  }

  const printfileById = buildPrintfileById(printfilesResult)

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

        const layerInputs: CompositeInput[] = []
        for (const l of layers) {
          if (isTextLayer(l)) {
            layerInputs.push({
              kind: 'text',
              text: l.text,
              fontFamily: l.fontFamily,
              fontSize: l.fontSize,
              color: l.color,
              dx: l.dx,
              dy: l.dy,
            })
          } else {
            const url = signedByPath.get(l.path)
            if (url) {
              layerInputs.push({ kind: 'image', signedUrl: url, s: l.s, dx: l.dx, dy: l.dy })
            }
          }
        }
        if (layerInputs.length === 0) return

        try {
          const compositedBuffer = await compositeLayersToBuffer(areaWidth, areaHeight, layerInputs)
          const compositePath = `${storageKeyPrefix}/composites/${placement}-${Date.now()}.png`
          const { error: uploadErr } = await admin.storage
            .from(BUCKET)
            .upload(compositePath, compositedBuffer, { contentType: 'image/png', upsert: true })
          if (uploadErr) {
            console.error('[prepareOrderPrintFiles] composite upload', uploadErr.message)
            return
          }
          const { data: compositeSigned } = await admin.storage
            .from(BUCKET)
            .createSignedUrls([compositePath], SIGNED_URL_FOR_PRINTFUL_SEC)
          const compositeUrl = compositeSigned?.[0]?.signedUrl
          if (compositeUrl) imageUrlByPlacement[placement] = compositeUrl
        } catch (err) {
          console.error('[prepareOrderPrintFiles] composite error', err)
        }
      })
    )
  }

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
    return { ok: false, reason: 'No printable files could be built for this design' }
  }

  return { ok: true, files: fileEntriesToOrderFiles(files) }
}
