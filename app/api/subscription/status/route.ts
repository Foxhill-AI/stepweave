import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type SubscriptionStatus = {
  subscription_tier: 'free' | 'starter' | 'pro'
  pending_tier: 'starter' | 'free' | null
  current_period_end_at: string | null
  status: 'active' | 'past_due' | 'canceled'
  cancel_at_period_end: boolean
}

export async function GET() {
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
    .select('id, subscription_tier, pending_tier')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()
  if (!userAccount?.id) {
    return NextResponse.json({ error: 'User account not found' }, { status: 403 })
  }

  const tier = (userAccount.subscription_tier as string) || 'free'
  const pendingTier = (userAccount.pending_tier as string | null) || null

  const { data: sub } = await supabase
    .from('user_subscription')
    .select('current_period_end_at, status')
    .eq('user_account_id', userAccount.id)
    .eq('provider', 'stripe')
    .maybeSingle()

  const resolvedTier = tier === 'starter' || tier === 'pro' ? tier : 'free'
  const resolvedStatus: SubscriptionStatus['status'] = sub
    ? ((sub.status as SubscriptionStatus['status']) ?? 'canceled')
    : (resolvedTier === 'starter' || resolvedTier === 'pro' ? 'active' : 'canceled')

  const result: SubscriptionStatus = {
    subscription_tier: resolvedTier,
    pending_tier: pendingTier === 'starter' || pendingTier === 'free' ? pendingTier : null,
    current_period_end_at: sub?.current_period_end_at ?? null,
    status: resolvedStatus,
    cancel_at_period_end: !!pendingTier,
  }
  return NextResponse.json(result)
}
