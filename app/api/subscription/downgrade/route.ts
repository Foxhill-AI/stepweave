import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/** Downgrade: schedule subscription to cancel at period end and set pending_tier. */
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
  const targetTier = typeof body.targetTier === 'string' ? body.targetTier.toLowerCase() : ''
  if (targetTier !== 'starter' && targetTier !== 'free') {
    return NextResponse.json(
      { error: 'Invalid targetTier. Use "starter" or "free".' },
      { status: 400 }
    )
  }

  const { data: sub } = await supabase
    .from('user_subscription')
    .select('stripe_subscription_id, current_period_end_at')
    .eq('user_account_id', userAccount.id)
    .eq('provider', 'stripe')
    .maybeSingle()

  if (!sub?.stripe_subscription_id) {
    const { error: updateError } = await supabase
      .from('user_account')
      .update({
        subscription_tier: targetTier,
        pending_tier: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userAccount.id)
    if (updateError) {
      console.error('downgrade: update user_account (no sub row) failed', updateError)
      return NextResponse.json({ error: 'Failed to update your plan.' }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      pending_tier: targetTier,
      current_period_end_at: null,
      message: 'Your plan has been set to Starter. If you are still being charged, cancel from your Stripe billing or contact support.',
    })
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY
  if (!stripeSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = new Stripe(stripeSecret)
  try {
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    })
  } catch (err) {
    console.error('Stripe subscription update (downgrade):', err)
    return NextResponse.json(
      { error: 'Failed to schedule downgrade with Stripe.' },
      { status: 502 }
    )
  }

  const { error: updateError } = await supabase
    .from('user_account')
    .update({
      pending_tier: targetTier,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userAccount.id)

  if (updateError) {
    console.error('downgrade: update user_account pending_tier failed', updateError)
    return NextResponse.json(
      { error: 'Failed to save downgrade preference.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    pending_tier: targetTier,
    current_period_end_at: sub.current_period_end_at,
    message: targetTier === 'free'
      ? 'Subscription will cancel at the end of the billing period.'
      : `You will move to ${targetTier} at the end of the billing period.`,
  })
}
