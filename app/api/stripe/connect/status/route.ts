import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type ConnectStatus = {
  stripe_connect_account_id: string | null
  stripe_connect_charges_enabled: boolean
  stripe_connect_payouts_enabled: boolean
  stripe_connect_details_submitted: boolean
  stripe_connect_onboarding_completed_at: string | null
  stripe_connect_last_synced_at: string | null
}

function mapRow(r: Record<string, unknown> | null): ConnectStatus | null {
  if (!r) return null
  return {
    stripe_connect_account_id: (r.stripe_connect_account_id as string | null) ?? null,
    stripe_connect_charges_enabled: Boolean(r.stripe_connect_charges_enabled),
    stripe_connect_payouts_enabled: Boolean(r.stripe_connect_payouts_enabled),
    stripe_connect_details_submitted: Boolean(r.stripe_connect_details_submitted),
    stripe_connect_onboarding_completed_at: (r.stripe_connect_onboarding_completed_at as string | null) ?? null,
    stripe_connect_last_synced_at: (r.stripe_connect_last_synced_at as string | null) ?? null,
  }
}

/**
 * GET /api/stripe/connect/status?sync=1
 * Returns Connect onboarding flags for the signed-in user. With sync=1, pulls latest from Stripe and updates DB.
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  }

  const sessionClient = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await sessionClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: row, error: fetchError } = await admin
    .from('user_account')
    .select(
      'id, stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_details_submitted, stripe_connect_onboarding_completed_at, stripe_connect_last_synced_at'
    )
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: 'User account not found' }, { status: 404 })
  }

  const sync = request.nextUrl.searchParams.get('sync') === '1'
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const accountId = row.stripe_connect_account_id as string | null

  if (sync && accountId && stripeSecret) {
    const stripe = new Stripe(stripeSecret)
    try {
      const acct = await stripe.accounts.retrieve(accountId)
      const charges = Boolean(acct.charges_enabled)
      const payouts = Boolean(acct.payouts_enabled)
      const details = Boolean(acct.details_submitted)
      const now = new Date().toISOString()
      const wasComplete = Boolean(row.stripe_connect_onboarding_completed_at)
      const nowComplete = charges && payouts
      const patch: Record<string, unknown> = {
        stripe_connect_charges_enabled: charges,
        stripe_connect_payouts_enabled: payouts,
        stripe_connect_details_submitted: details,
        stripe_connect_last_synced_at: now,
        updated_at: now,
      }
      if (nowComplete && !wasComplete) {
        patch.stripe_connect_onboarding_completed_at = now
      }
      await admin.from('user_account').update(patch).eq('id', row.id)
      const { data: refreshed } = await admin
        .from('user_account')
        .select(
          'stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_details_submitted, stripe_connect_onboarding_completed_at, stripe_connect_last_synced_at'
        )
        .eq('id', row.id)
        .single()
      return NextResponse.json(mapRow(refreshed as Record<string, unknown>))
    } catch (e) {
      console.warn('stripe connect status sync failed', e)
    }
  }

  return NextResponse.json(mapRow(row as Record<string, unknown>))
}
