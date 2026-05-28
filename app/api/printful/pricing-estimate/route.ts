import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { estimatePrintfulListingCosts } from '@/lib/printful/pricingEstimate'
import { getCreatorShareRate } from '@/lib/platformFee'

/**
 * POST /api/printful/pricing-estimate
 * Body: { productId: string, variantId: number, quantity?: number }
 * Returns catalog fulfillment + shipping costs + minimum viable price.
 * MVP is the same for all creator tiers — the tier only affects how the margin
 * above MVP is split between creator and platform, not the floor itself.
 * Tax is intentionally excluded — collected from buyers at checkout.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.PRINTFUL_API_KEY?.trim()
  const storeId = process.env.PRINTFUL_STORE_ID?.trim()
  if (!apiKey || !storeId) {
    return NextResponse.json({ error: 'Printful API not configured' }, { status: 503 })
  }

  let body: { productId?: string; variantId?: unknown; quantity?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const productId = typeof body.productId === 'string' ? body.productId.trim() : ''
  const variantRaw = body.variantId
  const variantId =
    typeof variantRaw === 'number'
      ? variantRaw
      : typeof variantRaw === 'string' && /^\d+$/.test(variantRaw)
        ? parseInt(variantRaw, 10)
        : NaN

  if (!productId || !Number.isFinite(variantId)) {
    return NextResponse.json(
      { error: 'productId (string) and variantId (number) are required' },
      { status: 400 }
    )
  }

  const qtyRaw = body.quantity
  const q =
    typeof qtyRaw === 'number'
      ? qtyRaw
      : typeof qtyRaw === 'string' && /^\d+$/.test(qtyRaw)
        ? parseInt(qtyRaw, 10)
        : 1
  const quantity = Math.max(1, Math.min(99, Math.floor(Number.isFinite(q) ? q : 1)))

  // Look up the creator's subscription tier to compute the correct minimum viable price.
  let creatorTier = 'free'
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) {
      const { data: account } = await supabase
        .from('user_account')
        .select('subscription_tier')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (account?.subscription_tier) creatorTier = String(account.subscription_tier)
    }
  } catch {
    // non-fatal: fall back to free tier pricing
  }

  const creatorShareRate = getCreatorShareRate(creatorTier)

  const zip = process.env.PRINTFUL_PRICING_SHIP_ZIP?.trim() || '90001'
  const city = process.env.PRINTFUL_PRICING_SHIP_CITY?.trim() || 'Los Angeles'
  const state = process.env.PRINTFUL_PRICING_SHIP_STATE?.trim() || 'CA'
  const country = process.env.PRINTFUL_PRICING_SHIP_COUNTRY?.trim() || 'US'
  const address1 = process.env.PRINTFUL_PRICING_SHIP_ADDRESS1?.trim() || '100 Main St'

  const result = await estimatePrintfulListingCosts({
    apiKey,
    storeId,
    productId,
    variantId,
    quantity,
    recipient: { address1, city, state_code: state, country_code: country, zip },
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  // Return tier info so the UI can show "you'll earn X% of the margin above the floor".
  return NextResponse.json({ ...result, creatorTier, creatorShareRate })
}
