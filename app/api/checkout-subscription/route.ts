import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function getPriceIdForTier(tier: string): string {
  if (tier === 'starter') return (process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '').trim()
  if (tier === 'pro') return (process.env.STRIPE_PRICE_PRO_MONTHLY ?? '').trim()
  return ''
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'You must be signed in to subscribe' },
        { status: 401 }
      )
    }

    const { data: userAccount } = await supabase
      .from('user_account')
      .select('id')
      .eq('auth_user_id', authUser.id)
      .maybeSingle()
    if (!userAccount?.id) {
      return NextResponse.json(
        { error: 'User account not found' },
        { status: 403 }
      )
    }
    const userAccountId = userAccount.id as number

    const body = await request.json().catch(() => ({}))
    const tier = typeof body.tier === 'string' ? body.tier.toLowerCase() : ''
    if (tier !== 'starter' && tier !== 'pro') {
      return NextResponse.json(
        { error: 'Invalid or missing tier. Use "starter" or "pro".' },
        { status: 400 }
      )
    }

    const priceId = getPriceIdForTier(tier)
    if (!priceId) {
      return NextResponse.json(
        { error: 'Subscription pricing is not configured for this tier.' },
        { status: 503 }
      )
    }
    if (!priceId.startsWith('price_')) {
      const hint = priceId.startsWith('prod_')
        ? 'You used a Product ID (prod_xxx). Use the Price ID (price_xxx) from the product’s pricing section in Stripe.'
        : /^\d+$/.test(priceId)
          ? 'You used the dollar amount. Use the Price ID (price_xxx) from Stripe Dashboard.'
          : 'Use the Price ID from Stripe Dashboard (e.g. price_xxx).'
      return NextResponse.json(
        { error: `Invalid Stripe Price ID. ${hint}` },
        { status: 503 }
      )
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY
    if (!stripeSecret) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 503 }
      )
    }

    const origin = request.headers.get('origin') || request.nextUrl.origin
    const stripe = new Stripe(stripeSecret)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/pricing?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/become-creator`,
      metadata: {
        user_account_id: String(userAccountId),
        tier,
      },
      subscription_data: {
        metadata: {
          user_account_id: String(userAccountId),
          tier,
        },
      },
    })

    if (!session.url) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (err) {
    console.error('checkout-subscription:', err)
    return NextResponse.json(
      { error: 'An error occurred while starting subscription' },
      { status: 500 }
    )
  }
}
