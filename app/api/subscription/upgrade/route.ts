import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function getPriceIdForTier(tier: string): string {
  if (tier === 'pro') return (process.env.STRIPE_PRICE_PRO_MONTHLY ?? '').trim()
  return ''
}

/**
 * Upgrade existing subscription (Starter → Pro) by updating the Stripe subscription
 * to the Pro price. Uses proration. Does not create a new subscription.
 */
export async function POST(request: NextRequest) {
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

  const currentTier = (userAccount.subscription_tier as string) || 'free'
  if (currentTier !== 'starter') {
    return NextResponse.json(
      { error: 'Upgrade is only available from Starter to Pro. You are already on a different plan.' },
      { status: 400 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const targetTier = typeof body.targetTier === 'string' ? body.targetTier.toLowerCase() : 'pro'
  if (targetTier !== 'pro') {
    return NextResponse.json(
      { error: 'Invalid targetTier. Use "pro".' },
      { status: 400 }
    )
  }

  const priceIdPro = getPriceIdForTier('pro')
  if (!priceIdPro || !priceIdPro.startsWith('price_')) {
    return NextResponse.json(
      { error: 'Pro subscription price is not configured.' },
      { status: 503 }
    )
  }

  const { data: sub } = await supabase
    .from('user_subscription')
    .select('stripe_subscription_id')
    .eq('user_account_id', userAccount.id)
    .eq('provider', 'stripe')
    .maybeSingle()

  const stripeSecret = process.env.STRIPE_SECRET_KEY
  if (!stripeSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = new Stripe(stripeSecret)

  if (!sub?.stripe_subscription_id) {
    const origin = request.headers.get('origin') || request.nextUrl?.origin || ''
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceIdPro, quantity: 1 }],
      success_url: `${origin}/pricing?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/settings`,
      metadata: { user_account_id: String(userAccount.id), tier: 'pro' },
      subscription_data: { metadata: { user_account_id: String(userAccount.id), tier: 'pro' } },
    })
    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }
    return NextResponse.json({ url: session.url })
  }

  let subscription: Stripe.Subscription
  try {
    subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, {
      expand: ['items.data.price'],
    })
  } catch (err) {
    console.error('Stripe subscription retrieve (upgrade):', err)
    return NextResponse.json(
      { error: 'Could not load your subscription.' },
      { status: 502 }
    )
  }

  const itemId = subscription.items.data[0]?.id
  if (!itemId) {
    return NextResponse.json(
      { error: 'Subscription has no line items.' },
      { status: 502 }
    )
  }

  try {
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: itemId, price: priceIdPro }],
      proration_behavior: 'create_prorations',
      metadata: {
        ...subscription.metadata,
        tier: 'pro',
      },
    })
  } catch (err) {
    console.error('Stripe subscription update (upgrade):', err)
    return NextResponse.json(
      { error: 'Failed to upgrade subscription with Stripe.' },
      { status: 502 }
    )
  }

  const { error: updateError } = await supabase
    .from('user_account')
    .update({
      subscription_tier: 'pro',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userAccount.id)

  if (updateError) {
    console.error('upgrade: update user_account subscription_tier failed', updateError)
    return NextResponse.json(
      { error: 'Subscription upgraded in Stripe but failed to update your plan locally. Please refresh or contact support.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    subscription_tier: 'pro',
    message: 'You are now on the Pro plan. You may be charged a prorated amount for the remainder of this period.',
  })
}
