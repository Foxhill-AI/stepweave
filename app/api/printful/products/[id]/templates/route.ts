import { NextRequest, NextResponse } from 'next/server'
import { PRINTFUL_BASE, type PrintfulPrintfilesResult } from '@/lib/printful/mockupTask'
import { buildPrintfileById, resolvePlacementKeys } from '@/lib/printful/buildMockupFiles'
import type { PlacementTemplateRow } from '@/lib/printful/placementTemplate'

/** Printful GET /mockup-generator/templates/{id} — layout images + print-area box metadata. */
type LayoutTemplateEntry = {
  template_id: number
  image_url?: string
  background_url?: string
  template_width?: number
  template_height?: number
  print_area_width?: number
  print_area_height?: number
  print_area_top?: number
  print_area_left?: number
}

type LayoutTemplatesResult = {
  variant_mapping?: Array<{
    variant_id: number
    templates: Array<{ placement: string; template_id: number }>
  }>
  templates?: LayoutTemplateEntry[]
}

function pickTemplateImageUrl(t: LayoutTemplateEntry): string {
  const bg = (t.background_url ?? '').trim()
  const img = (t.image_url ?? '').trim()
  // Prefer flat product background when present; else full mockup image
  return bg || img
}

/**
 * GET /api/printful/products/[id]/templates?variant_id=
 *
 * Uses Printful **layout templates** (`GET /mockup-generator/templates/{productId}`), not
 * `create-task` with `option_groups`. In Printful’s API, `option_groups` are mockup *styles*
 * (e.g. "Flat", "Men's") from printfiles — there is no "Template" group; passing it filters
 * out all variants and returns 400 "No variants to generate".
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
    const [productRes, printfilesRes, layoutRes] = await Promise.all([
      fetch(`${PRINTFUL_BASE}/products/${productId}`, { headers }),
      fetch(`${PRINTFUL_BASE}/mockup-generator/printfiles/${productId}`, { headers }),
      fetch(`${PRINTFUL_BASE}/mockup-generator/templates/${productId}`, { headers }),
    ])

    if (!productRes.ok) {
      console.error('[templates] product', productRes.status, await productRes.text())
      return NextResponse.json({ error: 'Failed to fetch product' }, { status: 502 })
    }
    if (!printfilesRes.ok) {
      console.error('[templates] printfiles', printfilesRes.status, await printfilesRes.text())
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
      return NextResponse.json({
        product_id: productId,
        variant_id: variantId,
        placements: [] as PlacementTemplateRow[],
        template_generation_unavailable: true,
      })
    }

    const printfileById = buildPrintfileById(printfilesResult)

    let layoutResult: LayoutTemplatesResult = {}
    if (layoutRes.ok) {
      const layoutJson = (await layoutRes.json()) as { result?: LayoutTemplatesResult }
      layoutResult = layoutJson.result ?? {}
    } else {
      const errText = await layoutRes.text()
      console.warn('[templates] layout templates HTTP', layoutRes.status, errText.slice(0, 500))
    }

    const byTemplateId = new Map<number, LayoutTemplateEntry>()
    for (const t of layoutResult.templates ?? []) {
      byTemplateId.set(t.template_id, t)
    }

    const variantLayout = layoutResult.variant_mapping?.find((v) => v.variant_id === variantId)

    const placements: PlacementTemplateRow[] = placementKeys.map((placement) => {
      const printfileId = variantMapping.placements[placement]
      const pf = printfileById.get(printfileId)
      const area_width = pf?.width ?? 1800
      const area_height = pf?.height ?? 1800

      const mapEntry = variantLayout?.templates?.find((x) => x.placement === placement)
      const layoutTpl = mapEntry ? byTemplateId.get(mapEntry.template_id) : undefined
      const template_url = layoutTpl ? pickTemplateImageUrl(layoutTpl) : ''

      const row: PlacementTemplateRow = {
        placement,
        label: availablePlacements[placement] ?? placement,
        template_url,
        area_width,
        area_height,
      }

      if (layoutTpl?.template_width != null) row.template_width = layoutTpl.template_width
      if (layoutTpl?.template_height != null) row.template_height = layoutTpl.template_height
      if (layoutTpl?.print_area_top != null) row.print_area_top = layoutTpl.print_area_top
      if (layoutTpl?.print_area_left != null) row.print_area_left = layoutTpl.print_area_left
      if (layoutTpl?.print_area_width != null) row.print_area_width = layoutTpl.print_area_width
      if (layoutTpl?.print_area_height != null) row.print_area_height = layoutTpl.print_area_height

      return row
    })

    const anyUrl = placements.some((p) => p.template_url)

    return NextResponse.json({
      product_id: productId,
      variant_id: variantId,
      placements,
      template_generation_unavailable: !anyUrl,
    })
  } catch (e) {
    console.error('[templates]', e)
    return NextResponse.json({ error: 'Unexpected error loading templates' }, { status: 500 })
  }
}
