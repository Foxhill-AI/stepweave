import { NextRequest, NextResponse } from 'next/server'
import { PRINTFUL_BASE } from '@/lib/printful/mockupTask'
import type { PrintfulPrintfilesResult } from '@/lib/printful/mockupTask'
import {
  buildPrintfileById,
  resolvePlacementKeys,
} from '@/lib/printful/buildMockupFiles'

export type PlacementMeta = {
  placement: string
  label: string
  area_width: number
  area_height: number
}

/**
 * GET /api/printful/products/[id]/placements?variant_id=
 * Print-area metadata for the placement editor (no mockup generation).
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
      return NextResponse.json({ error: 'Failed to fetch product' }, { status: 502 })
    }
    if (!printfilesRes.ok) {
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
      return NextResponse.json({ error: 'No variants found' }, { status: 404 })
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
      return NextResponse.json({ product_id: productId, variant_id: variantId, placements: [] })
    }

    const printfileById = buildPrintfileById(printfilesResult)

    const placements: PlacementMeta[] = placementKeys.map((placement) => {
      const pid = variantMapping.placements[placement]
      const pf = printfileById.get(pid)
      return {
        placement,
        label: availablePlacements[placement] ?? placement,
        area_width: pf?.width ?? 1800,
        area_height: pf?.height ?? 1800,
      }
    })

    return NextResponse.json({
      product_id: productId,
      variant_id: variantId,
      placements,
    })
  } catch (e) {
    console.error('[placements]', e)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
