import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  createTaskAndPoll,
  mergeMockups,
  PRINTFUL_BASE,
  type PrintfulPrintfilesResult,
} from '@/lib/printful/mockupTask'
import {
  PRINTFUL_SLOT_BUSY_CODE,
  tryAcquirePrintfulMockupSlot,
  releasePrintfulMockupSlot,
} from '@/lib/printful/mockupSlot'
import {
  buildMockupFileEntries,
  buildPrintfileById,
  resolvePlacementKeys,
} from '@/lib/printful/buildMockupFiles'

const DEFAULT_PLACEHOLDER_IMAGE_URL = 'https://files.cdn.printful.com/upload/product-catalog-img/b7/b7427e7543b29d4f52a8bd5e4d80c946_l'

export type PlacementMockup = {
  placement: string
  label: string
  mockup_url: string
}

/**
 * GET /api/printful/products/[id]/mockup-images?variant_id=
 * Catalog mockups using placeholder (or env) image — populates placement tabs when no user pattern yet.
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

    const { placementKeys, variantMapping } = resolvePlacementKeys(
      printfilesResult,
      variantId
    )
    if (!variantMapping || placementKeys.length === 0) {
      return NextResponse.json(
        { error: 'No print placements for this variant', placements: [] },
        { status: 200 }
      )
    }

    const printfileById = buildPrintfileById(printfilesResult)
    const allFiles = buildMockupFileEntries({
      placementKeys,
      variantMapping,
      printfileById,
      imageUrlByPlacement: {},
      defaultImageUrl: placeholderUrl,
      placementTransforms: {},
    })

    const urlByPlacement = new Map<string, string>()

    const placementsPayload = (): PlacementMockup[] =>
      placementKeys.map((placement) => ({
        placement,
        label: availablePlacements[placement] ?? placement,
        mockup_url: urlByPlacement.get(placement) ?? '',
      }))

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin =
      supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null

    const slotHolder = crypto.randomUUID()
    const slot = admin
      ? await tryAcquirePrintfulMockupSlot(admin, slotHolder)
      : 'skipped'
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

    let batch: Awaited<ReturnType<typeof createTaskAndPoll>>
    try {
      batch = await createTaskAndPoll(productId, variantId, allFiles, headers)
    } finally {
      if (admin && slot === 'granted') {
        await releasePrintfulMockupSlot(admin, slotHolder)
      }
    }

    if (batch.ok) {
      mergeMockups(urlByPlacement, batch.mockups)
    } else {
      console.warn('[mockup-images] batch failed:', batch.reason)
    }

    const placements = placementsPayload()
    const anyUrl = placements.some((p) => p.mockup_url)

    return NextResponse.json({
      product_id: productId,
      variant_id: variantId,
      placements,
      mockup_generation_unavailable: !anyUrl,
    })
  } catch (e) {
    console.error('[mockup-images]', e)
    return NextResponse.json({ error: 'Unexpected error generating mockups' }, { status: 500 })
  }
}
