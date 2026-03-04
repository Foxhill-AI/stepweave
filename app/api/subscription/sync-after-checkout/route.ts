import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * After checkout, Stripe redirects to success_url with session_id.
 * If the webhook hasn't run yet (e.g. local dev without Stripe CLI), the DB still has tier=free.
 * This route fetches the session from Stripe and updates user_account + user_subscription
 * so the UI shows the correct plan without relying on the webhook.
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
    .select('id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()
  if (!userAccount?.id) {
    return NextResponse.json({ error: 'User account not found' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const sessionId = typeof body?.session_id === 'string' ? body.session_id.trim() : ''
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return NextResponse.json({ error: 'Invalid or missing session_id' }, { status: 400 })
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY
  if (!stripeSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = new Stripe(stripeSecret)
  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })
  } catch (e) {
    console.error('sync-after-checkout: retrieve session', e)
    return NextResponse.json({ error: 'Invalid session' }, { status: 400 })
  }

  if (session.mode !== 'subscription' || session.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Session not a paid subscription' }, { status: 400 })
  }

  const userAccountIdRaw = session.metadata?.user_account_id
  const tier = session.metadata?.tier
  if (!userAccountIdRaw || (tier !== 'starter' && tier !== 'pro')) {
    return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
  }
  const userAccountId = Number(userAccountIdRaw)
  if (userAccountId !== userAccount.id) {
    return NextResponse.json({ error: 'Session does not belong to this user' }, { status: 403 })
  }

  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  if (!subscriptionId || !customerId) {
    return NextResponse.json({ error: 'Missing subscription or customer' }, { status: 400 })
  }

  let currentPeriodEnd: string | null = null
  const expandedSub = session.subscription && typeof session.subscription === 'object' ? session.subscription : null
  if (expandedSub && 'current_period_end' in expandedSub) {
    const end = Number((expandedSub as { current_period_end?: number }).current_period_end)
    if (end) currentPeriodEnd = new Date(end * 1000).toISOString()
  }
  if (!currentPeriodEnd) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId) as { current_period_end?: number }
      if (sub.current_period_end) currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString()
    } catch {
      // ignore
    }
  }

  const { error: updateTierError } = await supabase
    .from('user_account')
    .update({
      subscription_tier: tier,
      pending_tier: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userAccountId)
  if (updateTierError) {
    console.error('sync-after-checkout: update user_account', updateTierError)
    return NextResponse.json({ error: 'Failed to update tier' }, { status: 500 })
  }

  await supabase
    .from('user_subscription')
    .upsert(
      {
        user_account_id: userAccountId,
        provider: 'stripe',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: 'active',
        current_period_end_at: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_account_id,provider', ignoreDuplicates: false }
    )

  return NextResponse.json({ ok: true, tier })
}
