import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { sendPendingPayoutEmail } from '@/lib/email'

/**
 * GET /api/cron/retry-creator-payouts
 *
 * Runs daily at 14:05 UTC via Vercel Cron.
 * 1. Finds unresolved pending_creator_payout rows.
 * 2. For each, checks if the creator's Connect account is now ready.
 *    - If ready: attempts the Stripe transfer, marks resolved, records in order_connect_transfer.
 *    - If still not ready: sends the day-3 follow-up email if 3+ days have passed and not yet sent.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!supabaseUrl || !serviceRoleKey || !stripeKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const stripe = new Stripe(stripeKey)

  // Fetch all unresolved pending payouts
  const { data: pending, error: fetchErr } = await admin
    .from('pending_creator_payout')
    .select('id, user_order_id, seller_user_account_id, amount_cents, currency, stripe_charge_id, created_at')
    .is('resolved_at', null)
    .order('created_at', { ascending: true })

  if (fetchErr) {
    console.error('[cron/retry-creator-payouts] fetch error', fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ retried: 0, emailed: 0, skipped: 0 })
  }

  let retried = 0
  let emailed = 0
  let skipped = 0

  for (const row of pending) {
    const {
      id: pendingId,
      user_order_id: orderId,
      seller_user_account_id: sellerUserAccountId,
      amount_cents: amountCents,
      currency,
      stripe_charge_id: chargeId,
      created_at: createdAt,
    } = row as {
      id: number
      user_order_id: number
      seller_user_account_id: number
      amount_cents: number
      currency: string
      stripe_charge_id: string
      created_at: string
    }

    // Check seller's Connect account status
    const { data: sellerRow } = await admin
      .from('user_account')
      .select('id, auth_user_id, username, stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled')
      .eq('id', sellerUserAccountId)
      .maybeSingle()

    if (!sellerRow) { skipped++; continue }

    const dest = sellerRow.stripe_connect_account_id as string | null
    const canReceive =
      Boolean(sellerRow.stripe_connect_charges_enabled) &&
      Boolean(sellerRow.stripe_connect_payouts_enabled) &&
      typeof dest === 'string' &&
      dest.startsWith('acct_')

    if (canReceive) {
      // Attempt the transfer
      try {
        const transfer = await stripe.transfers.create(
          {
            amount: amountCents,
            currency,
            destination: dest,
            source_transaction: chargeId,
            metadata: {
              user_order_id: String(orderId),
              seller_user_account_id: String(sellerUserAccountId),
            },
          },
          { idempotencyKey: `order-${orderId}-seller-${sellerUserAccountId}` }
        )

        // Record in order_connect_transfer
        await admin.from('order_connect_transfer').upsert(
          {
            user_order_id: orderId,
            seller_user_account_id: sellerUserAccountId,
            amount_cents: amountCents,
            currency,
            stripe_transfer_id: transfer.id,
            stripe_charge_id: chargeId,
          },
          { onConflict: 'user_order_id,seller_user_account_id', ignoreDuplicates: true }
        )

        // Mark pending payout resolved
        await admin
          .from('pending_creator_payout')
          .update({ resolved_at: new Date().toISOString(), last_retry_at: new Date().toISOString(), retry_count: (row as { retry_count?: number }).retry_count ?? 0 + 1 })
          .eq('id', pendingId)

        console.info('[cron/retry-creator-payouts] transfer succeeded', { orderId, sellerUserAccountId, transferId: transfer.id })
        retried++
      } catch (e) {
        console.error('[cron/retry-creator-payouts] transfer failed', orderId, sellerUserAccountId, e)
        await admin
          .from('pending_creator_payout')
          .update({ last_retry_at: new Date().toISOString() })
          .eq('id', pendingId)
        skipped++
      }
      continue
    }

    // Creator still not set up — check if we should send the day-3 follow-up email
    const createdAtMs = new Date(createdAt).getTime()
    const daysSinceCreated = (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24)

    if (daysSinceCreated >= 3) {
      const { data: existingEmail } = await admin
        .from('pending_payout_email')
        .select('id')
        .eq('user_order_id', orderId)
        .eq('seller_user_account_id', sellerUserAccountId)
        .eq('email_type', 'day3')
        .maybeSingle()

      if (!existingEmail && sellerRow.auth_user_id) {
        const { data: authUser } = await admin.auth.admin.getUserById(sellerRow.auth_user_id as string)
        const email = authUser?.user?.email
        if (email) {
          const result = await sendPendingPayoutEmail({
            to: email,
            username: (sellerRow.username as string | null) ?? 'there',
            amountDollars: amountCents / 100,
            currency,
            emailType: 'day3',
          })
          if (result.ok) {
            await admin.from('pending_payout_email').insert({
              seller_user_account_id: sellerUserAccountId,
              user_order_id: orderId,
              email_type: 'day3',
            })
            emailed++
          }
        }
      } else {
        skipped++
      }
    } else {
      skipped++
    }
  }

  console.info('[cron/retry-creator-payouts] done', { retried, emailed, skipped })
  return NextResponse.json({ retried, emailed, skipped })
}
