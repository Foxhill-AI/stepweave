import { NextRequest, NextResponse } from 'next/server'

const PRINTFUL_BASE = 'https://api.printful.com'

type PrintfulStore = {
  id: number
  name?: string
  [key: string]: unknown
}

type PrintfulStoresResponse = {
  code?: number
  result?: PrintfulStore[]
  [key: string]: unknown
}

/**
 * GET /api/printful/stores
 *
 * Small utility endpoint to list Printful stores for the current account.
 * Uses PRINTFUL_API_KEY from environment variables and returns the list of
 * stores plus their ids, so you can determine PRINTFUL_STORE_ID.
 */
export async function GET(_req: NextRequest) {
  const apiKey = process.env.PRINTFUL_API_KEY
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: 'Printful API key not configured (PRINTFUL_API_KEY)' },
      { status: 503 }
    )
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
  }

  try {
    const res = await fetch(`${PRINTFUL_BASE}/stores`, { headers })
    if (!res.ok) {
      const body = await res.text()
      console.error('[api/printful/stores] HTTP error', res.status, body)
      return NextResponse.json(
        { error: 'Failed to fetch stores from Printful', status: res.status },
        { status: 502 }
      )
    }

    const data = (await res.json()) as PrintfulStoresResponse
    const stores = data.result ?? []

    // Helpful log for local debugging
    if (stores.length > 0) {
      console.log('[api/printful/stores] Available stores:')
      for (const s of stores) {
        console.log(`- id=${s.id} name=${s.name ?? '(no name)'}`)
      }
    } else {
      console.warn('[api/printful/stores] No stores returned from Printful')
    }

    return NextResponse.json({
      stores: stores.map((s) => ({ id: s.id, name: s.name ?? null })),
      count: stores.length,
    })
  } catch (error) {
    console.error('[api/printful/stores] Unexpected error', error)
    return NextResponse.json(
      { error: 'Unexpected error while fetching stores from Printful' },
      { status: 500 }
    )
  }
}

