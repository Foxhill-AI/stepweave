import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { estimatePrintfulListingCosts } from '@/lib/printful/pricingEstimate'

/**
 * POST /api/design-drafts/[id]/self-purchase
 * Creates a Stripe Checkout session for the designer to buy their own custom shoes at cost.
 * No storefront product is created — order goes directly to Printful after payment.
 *
 * Requires DB migration:
 *   ALTER TABLE user_order ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'storefront';
 *   ALTER TABLE order_item ALTER COLUMN product_id DROP NOT NULL;
 *   ALTER TABLE order_item ALTER COLUMN product_variant_id DROP NOT NULL;
 */
export async function POST(
  request: NextRequest,
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

  const { data: userAccount } = await supabase
    .from('user_account')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()
  if (!userAccount?.id) {
    return NextResponse.json({ error: 'User account not found' }, { status: 403 })
  }

  const { data: draft } = await supabase
    .from('design_draft')
    .select('id, user_account_id, base_model_id, design_state, pattern_image_url, structural_color')
    .eq('id', draftId)
    .maybeSingle()

  if (!draft || (draft.user_account_id as number) !== (userAccount.id as number)) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  // Accept optional variantId override (e.g. buyer selected a different size in the buy modal).
  let bodyVariantId: number | null = null
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const bv = body.variantId
    if (typeof bv === 'number') bodyVariantId = bv
    else if (typeof bv === 'string' && /^\d+$/.test(bv)) bodyVariantId = parseInt(bv, 10)
  } catch { /* no body */ }

  const designState = (draft.design_state ?? {}) as Record<string, unknown>
  const variantRaw = designState.printful_variant_id
  const draftVariantId =
    typeof variantRaw === 'number'
      ? variantRaw
      : typeof variantRaw === 'string' && /^\d+$/.test(variantRaw)
        ? parseInt(variantRaw, 10)
        : null
  const variantId = bodyVariantId ?? draftVariantId

  if (!variantId) {
    return NextResponse.json(
      { error: 'Please select a color and size before purchasing.' },
      { status: 400 }
    )
  }

  const productId = String(draft.base_model_id ?? '').trim()
  if (!productId) {
    return NextResponse.json({ error: 'Draft has no base model.' }, { status: 400 })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  const printfulApiKey = process.env.PRINTFUL_API_KEY?.trim()
  const printfulStoreId = process.env.PRINTFUL_STORE_ID?.trim()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!stripeKey || !printfulApiKey || !printfulStoreId || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // Get pricing estimate to determine the cost price
  const estimate = await estimatePrintfulListingCosts({
    apiKey: printfulApiKey,
    storeId: printfulStoreId,
    productId,
    variantId,
    quantity: 1,
    recipient: {
      address1: process.env.PRINTFUL_PRICING_SHIP_ADDRESS1?.trim() || '100 Main St',
      city: process.env.PRINTFUL_PRICING_SHIP_CITY?.trim() || 'Los Angeles',
      state_code: process.env.PRINTFUL_PRICING_SHIP_STATE?.trim() || 'CA',
      country_code: process.env.PRINTFUL_PRICING_SHIP_COUNTRY?.trim() || 'US',
      zip: process.env.PRINTFUL_PRICING_SHIP_ZIP?.trim() || '90001',
    },
  })

  if (!estimate.ok) {
    return NextResponse.json(
      { error: `Could not estimate price: ${estimate.error}` },
      { status: 422 }
    )
  }

  // DB stores prices in dollars (consistent with storefront orders); Stripe needs cents.
  const unitAmountDollars = estimate.minimumViablePrice
  const unitAmountCents = Math.round(unitAmountDollars * 100)

  const admin = createClient(supabaseUrl, serviceRoleKey)

  // Create order record
  const { data: order, error: orderError } = await admin
    .from('user_order')
    .insert({
      user_account_id: userAccount.id,
      total_amount: unitAmountDollars,
      currency: 'usd',
      status: 'pending',
      order_type: 'self_purchase',
    })
    .select('id')
    .single()

  if (orderError || !order) {
    console.error('[self-purchase] createOrder', orderError?.message)
    return NextResponse.json({ error: 'Failed to create order.' }, { status: 500 })
  }

  const orderId = order.id as number

  // Freeze the design state as a snapshot (same format fulfillment engine reads)
  const designSnapshot = {
    design_state: draft.design_state,
    pattern_image_url: draft.pattern_image_url,
    base_model_id: draft.base_model_id,
    structural_color: draft.structural_color,
    captured_at: new Date().toISOString(),
  }

  // Create order item — product_id/variant_id are null for self-purchase (no storefront product)
  const { error: itemError } = await admin.from('order_item').insert({
    order_id: orderId,
    product_name: 'Custom Shoe Design',
    variant_label: null,
    quantity: 1,
    unit_price: unitAmountDollars,
    subtotal: unitAmountDollars,
    design_draft_id: draftId,
    design_snapshot: designSnapshot,
  })

  if (itemError) {
    console.error('[self-purchase] createOrderItem', itemError?.message)
    await admin.from('user_order').delete().eq('id', orderId)
    return NextResponse.json({ error: 'Failed to create order item.' }, { status: 500 })
  }

  // Create Stripe Checkout session — Stripe collects shipping address
  const stripe = new Stripe(stripeKey)
  const origin =
    request.headers.get('origin') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Custom Shoe Design — Your Pair' },
            unit_amount: unitAmountCents,
          },
          quantity: 1,
        },
      ],
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'NL', 'SE', 'JP'],
      },
      metadata: { order_id: String(orderId) },
      success_url: `${origin}/order/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/design-tool/${draftId}`,
    })
  } catch (e) {
    console.error('[self-purchase] stripe session', e)
    await admin.from('order_item').delete().eq('order_id', orderId)
    await admin.from('user_order').delete().eq('id', orderId)
    return NextResponse.json({ error: 'Could not create checkout session.' }, { status: 502 })
  }

  // Link Stripe session to order
  await admin
    .from('user_order')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', orderId)

  return NextResponse.json({
    url: session.url,
    minimumViablePrice: estimate.minimumViablePrice,
    currency: estimate.currency,
  })
}
