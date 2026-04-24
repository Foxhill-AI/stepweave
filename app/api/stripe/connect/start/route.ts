import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { stripeConnectBaseUrl } from '@/lib/stripe/connectBaseUrl'

/**
 * POST /api/stripe/connect/start
 * Ensures an Express Connect account exists for the signed-in user and returns an Account Link URL for onboarding.
 */
export async function POST() {
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  if (!stripeSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

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
    .select('id, stripe_connect_account_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  if (!row?.id) {
    return NextResponse.json({ error: 'User account not found' }, { status: 404 })
  }

  const userAccountId = row.id as number
  const stripe = new Stripe(stripeSecret)
  let connectAccountId = row.stripe_connect_account_id as string | null

  if (!connectAccountId) {
    const country = (process.env.STRIPE_CONNECT_DEFAULT_COUNTRY || 'US').trim().toUpperCase()
    const account = await stripe.accounts.create({
      type: 'express',
      country,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        user_account_id: String(userAccountId),
      },
    })
    connectAccountId = account.id
    const { error: updateError } = await admin
      .from('user_account')
      .update({
        stripe_connect_account_id: connectAccountId,
        stripe_connect_last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userAccountId)
    if (updateError) {
      console.error('stripe connect: failed to save account id', updateError)
      return NextResponse.json({ error: 'Failed to save Connect account' }, { status: 500 })
    }
  }

  const base = stripeConnectBaseUrl()
  const returnUrl = `${base}/profile?tab=settings&sub=payments&connect=return`
  const refreshUrl = `${base}/profile?tab=settings&sub=payments&connect=refresh`

  const link = await stripe.accountLinks.create({
    account: connectAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  })

  return NextResponse.json({ url: link.url })
}
