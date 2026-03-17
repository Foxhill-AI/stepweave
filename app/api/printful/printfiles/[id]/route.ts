import { NextRequest, NextResponse } from 'next/server'

const PRINTFUL_BASE = 'https://api.printful.com'

/** Printful mockup-generator printfiles response (result object). */
type PrintfulPrintfilesResult = {
  product_id?: number
  available_placements?: Record<string, string>
  option_groups?: string[]
  options?: string[]
  printfiles?: unknown[]
  variant_printfiles?: unknown[]
  [key: string]: unknown
}

/** Normalized view for UI: our label + Printful placement key for mockup generation. */
export type ProductView = {
  label: string
  placementKey: string
}

/** Placement key → our view label. */
const PLACEMENT_TO_VIEW: Record<string, string> = {
  front: 'Front',
  back: 'Back',
  left: 'Left side',
  right: 'Right side',
  default: 'Default',
}

/**
 * GET /api/printful/printfiles/[id]
 * Fetches mockup-generator printfiles for a product and returns available views
 * (placements + options) so the UI can show only allowed views and map to placement keys.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const productId = id?.trim()
  if (!productId) {
    return NextResponse.json({ error: 'Product id required' }, { status: 400 })
  }

  const apiKey = process.env.PRINTFUL_API_KEY
  const storeId = process.env.PRINTFUL_STORE_ID?.trim()
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: 'Printful API not configured' },
      { status: 503 }
    )
  }
  if (!storeId) {
    return NextResponse.json(
      { error: 'Printful store ID not configured (PRINTFUL_STORE_ID required for mockup-generator)' },
      { status: 503 }
    )
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    'X-PF-Store-Id': storeId,
  }

  try {
    const res = await fetch(
      `${PRINTFUL_BASE}/mockup-generator/printfiles/${productId}`,
      { headers }
    )
    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      const err = await res.text()
      console.error('[api/printful/printfiles/[id]]', res.status, err)
      return NextResponse.json(
        { error: 'Failed to fetch printfiles' },
        { status: 502 }
      )
    }

    const data = (await res.json()) as {
      code?: number
      result?: PrintfulPrintfilesResult
    }
    const result = data.result
    const placements = result?.available_placements ?? {}
    const optionGroups = result?.option_groups ?? []
    const options = result?.options ?? []

    const placementKeys = Object.keys(placements)
    const views: ProductView[] = []

    for (const key of placementKeys) {
      const label = PLACEMENT_TO_VIEW[key] ?? placements[key] ?? key
      views.push({ label, placementKey: key })
    }

    if (views.length === 0 && options.length > 0) {
      for (const opt of options) {
        const key = opt.toLowerCase().replace(/\s+/g, '_')
        const label = PLACEMENT_TO_VIEW[key] ?? opt
        views.push({ label, placementKey: opt })
      }
    }

    if (views.length === 0 && optionGroups.length > 0) {
      for (const grp of optionGroups) {
        const key = grp.toLowerCase().replace(/\s+/g, '_')
        const label = PLACEMENT_TO_VIEW[key] ?? grp
        views.push({ label, placementKey: grp })
      }
    }

    return NextResponse.json({
      productId,
      available_placements: placements,
      option_groups: optionGroups,
      options,
      views,
    })
  } catch (e) {
    console.error('[api/printful/printfiles/[id]]', e)
    return NextResponse.json(
      { error: 'Failed to fetch printfiles' },
      { status: 500 }
    )
  }
}
