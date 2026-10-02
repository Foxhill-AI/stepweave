import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getModelPricing } from '@/lib/printful/modelPricing'
import { getCreatorShareRate } from '@/lib/platformFee'
import { STRIPE_RATE, PLATFORM_BUFFER_RATE } from '@/lib/printful/pricingEstimate'

/**
 * POST /api/design-drafts/[id]/self-purchase
 * Creates a Stripe Checkout session for the designer to buy their own custom shoes.
 *
 * Pricing by tier:
 *   free    → fixedPrice (full listing price)
 *   starter → fixedPrice − (margin × 50%)
 *   pro     → fixedPrice − (margin × 90%)
 *
 * margin = fixedPrice × (1 − STRIPE_RATE − PLATFORM_BUFFER_RATE) − baseCosts
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
    .select('id, subscription_tier')
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

  // Look up fixed pricing from platform config
  const modelPricing = getModelPricing(productId)
  if (!modelPricing) {
    return NextResponse.json(
      { error: 'This shoe model does not have a configured price. Please contact support.' },
      { status: 422 }
    )
  }

  // Compute tier-discounted price
  const tier = String(userAccount.subscription_tier ?? 'free')
  const shareRate = tier === 'free' ? 0 : getCreatorShareRate(tier)
  const margin = Math.max(
    0,
    modelPricing.fixedPrice * (1 - STRIPE_RATE - PLATFORM_BUFFER_RATE) - modelPricing.baseCosts
  )
  const discount = Math.round(margin * shareRate * 100) / 100
  const unitAmountDollars = Math.round((modelPricing.fixedPrice - discount) * 100) / 100
  const unitAmountCents = Math.round(unitAmountDollars * 100)

  const stripeKey = process.env.STRIPE_SECRET_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!stripeKey || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

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

  const designSnapshot = {
    design_state: draft.design_state,
    pattern_image_url: draft.pattern_image_url,
    base_model_id: draft.base_model_id,
    structural_color: draft.structural_color,
    captured_at: new Date().toISOString(),
  }

  const { error: itemError } = await admin.from('order_item').insert({
    order_id: orderId,
    product_name: modelPricing.name,
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

  const stripe = new Stripe(stripeKey)
  const origin =
    request.headers.get('origin') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'

  const lineItemName = discount > 0
    ? `${modelPricing.name} — Your Pair (${tier} member price)`
    : `${modelPricing.name} — Your Pair`

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: lineItemName },
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

  await admin
    .from('user_order')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', orderId)

  return NextResponse.json({ url: session.url })
}
