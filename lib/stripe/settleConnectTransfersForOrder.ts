import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getOrderById } from '@/lib/supabaseClient'
import { sendPendingPayoutEmail, sendAdminAlert } from '@/lib/email'

/**
 * After a platform Checkout payment succeeds, transfer each seller's net (Phase 2 snapshot)
 * to their Connect Express account. Uses the charge as source_transaction (multi-seller safe).
 * Idempotent: unique (user_order_id, seller_user_account_id) + Stripe idempotency keys.
 */
export async function settleConnectTransfersForOrder(
  orderId: number,
  stripe: Stripe,
  client: SupabaseClient,
  paymentIntentId: string | null
): Promise<void> {
  const disabled = process.env.STRIPE_CONNECT_SETTLEMENT_ENABLED?.trim().toLowerCase()
  if (disabled === '0' || disabled === 'false' || disabled === 'no') {
    return
  }

  if (!paymentIntentId?.trim()) {
    console.warn('[connect-settlement] missing payment_intent for order', orderId)
    return
  }

  const order = await getOrderById(orderId, client)
  if (!order || String(order.status) !== 'paid') {
    console.warn('[connect-settlement] order not paid or missing', orderId)
    return
  }

  const currency = (order.currency ?? 'usd').toLowerCase()
  const items = order.order_item ?? []

  const bySeller = new Map<number, number>()
  for (const it of items) {
    const sid = it.seller_user_account_id
    if (sid == null || !Number.isInteger(sid) || sid <= 0) continue
    const net = Number(it.seller_net_amount ?? 0)
    if (!(net > 0)) continue
    bySeller.set(sid, (bySeller.get(sid) ?? 0) + net)
  }

  if (bySeller.size === 0) {
    return
  }

  let chargeId: string | null = null
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    const lc = pi.latest_charge
    chargeId = typeof lc === 'string' ? lc : lc?.id ?? null
  } catch (e) {
    console.error('[connect-settlement] retrieve PaymentIntent failed', orderId, e)
    return
  }
  if (!chargeId) {
    console.error('[connect-settlement] no latest_charge on PaymentIntent', orderId, paymentIntentId)
    return
  }

  for (const [sellerUserAccountId, netTotal] of Array.from(bySeller.entries())) {
    const amountCents = Math.round(netTotal * 100)
    if (amountCents <= 0) continue

    const { data: existing } = await client
      .from('order_connect_transfer')
      .select('id, stripe_transfer_id')
      .eq('user_order_id', orderId)
      .eq('seller_user_account_id', sellerUserAccountId)
      .maybeSingle()

    if (existing?.stripe_transfer_id) {
      continue
    }

    const { data: sellerRow, error: sellerErr } = await client
      .from('user_account')
      .select(
        'id, stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled'
      )
      .eq('id', sellerUserAccountId)
      .maybeSingle()

    if (sellerErr || !sellerRow) {
      console.warn('[connect-settlement] seller account not found', sellerUserAccountId, sellerErr)
      continue
    }

    const dest = sellerRow.stripe_connect_account_id as string | null
    const canReceive =
      Boolean(sellerRow.stripe_connect_charges_enabled) &&
      Boolean(sellerRow.stripe_connect_payouts_enabled) &&
      typeof dest === 'string' &&
      dest.startsWith('acct_')

    if (!canReceive) {
      console.warn(
        '[connect-settlement] seller not ready for transfers; recording pending payout',
        orderId,
        sellerUserAccountId
      )

      // Upsert a pending payout row so the retry cron can pick it up
      const { error: pendingErr } = await client.from('pending_creator_payout').upsert(
        {
          user_order_id: orderId,
          seller_user_account_id: sellerUserAccountId,
          amount_cents: amountCents,
          currency,
          stripe_charge_id: chargeId,
        },
        { onConflict: 'user_order_id,seller_user_account_id', ignoreDuplicates: true }
      )
      if (pendingErr) {
        console.error('[connect-settlement] upsert pending_creator_payout failed', orderId, sellerUserAccountId, pendingErr)
        sendAdminAlert({
          subject: `Payout retry state lost — Order #${orderId}`,
          title: `Payout retry state lost — Order #${orderId}`,
          body: `Failed to save pending payout record for seller <strong>${sellerUserAccountId}</strong> on order <strong>#${orderId}</strong>. The retry cron will not find this payout — manual intervention required.`,
          detail: `Error: ${pendingErr.message}`,
        }).catch(() => {})
      }

      // Send day-0 email if not already sent
      const { data: existingEmail } = await client
        .from('pending_payout_email')
        .select('id')
        .eq('user_order_id', orderId)
        .eq('seller_user_account_id', sellerUserAccountId)
        .eq('email_type', 'day0')
        .maybeSingle()

      if (!existingEmail) {
        const { data: authData } = await client
          .from('user_account')
          .select('auth_user_id, username')
          .eq('id', sellerUserAccountId)
          .maybeSingle()

        if (authData?.auth_user_id) {
          // We need service role to get the email — caller passes client which may be admin
          // so attempt getUserById; if it fails (anon client), skip silently
          try {
            const adminClient = client as unknown as {
              auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email?: string } | null } }> } }
            }
            const { data: authUser } = await adminClient.auth.admin.getUserById(authData.auth_user_id)
            const email = authUser?.user?.email
            if (email) {
              const result = await sendPendingPayoutEmail({
                to: email,
                username: (authData.username as string | null) ?? 'there',
                amountDollars: amountCents / 100,
                currency,
                emailType: 'day0',
              })
              if (result.ok) {
                // upsert so a concurrent duplicate webhook can't send a second email
                await client.from('pending_payout_email').upsert(
                  {
                    seller_user_account_id: sellerUserAccountId,
                    user_order_id: orderId,
                    email_type: 'day0',
                  },
                  { onConflict: 'user_order_id,seller_user_account_id,email_type', ignoreDuplicates: true }
                )
              }
            }
          } catch (e) {
            console.warn('[connect-settlement] could not send pending payout email', e)
          }
        }
      }

      continue
    }

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
        {
          idempotencyKey: `order-${orderId}-seller-${sellerUserAccountId}`,
        }
      )

      // Upsert so that if the transfer succeeded but the DB write failed on a
      // prior attempt, the retry can record it without hitting the unique constraint.
      const { error: insErr } = await client.from('order_connect_transfer').upsert(
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

      if (insErr) {
        console.error('[connect-settlement] upsert order_connect_transfer', orderId, sellerUserAccountId, insErr)
        sendAdminAlert({
          subject: `Transfer recorded in Stripe but not in DB — Order #${orderId}`,
          title: `Transfer audit trail missing — Order #${orderId}`,
          body: `Stripe transfer to seller <strong>${sellerUserAccountId}</strong> succeeded but the database record failed to save. The creator has been paid but there is no audit trail. Manual DB insert may be required.`,
          detail: `Error: ${insErr.message}`,
        }).catch(() => {})
      }

      // If a pending payout row exists for this order+seller (from a prior attempt
      // that found the seller unready), mark it resolved now that the transfer went through.
      await client
        .from('pending_creator_payout')
        .update({ resolved_at: new Date().toISOString() })
        .eq('user_order_id', orderId)
        .eq('seller_user_account_id', sellerUserAccountId)
        .is('resolved_at', null)
    } catch (e) {
      console.error('[connect-settlement] transfers.create failed', orderId, sellerUserAccountId, e)
      const reason = e instanceof Error ? e.message : String(e)
      sendAdminAlert({
        subject: `Stripe transfer failed — Order #${orderId}`,
        title: `Stripe transfer failed — Order #${orderId}`,
        body: `Failed to transfer funds to seller <strong>${sellerUserAccountId}</strong> for order <strong>#${orderId}</strong>. The creator has not been paid. The retry cron will not catch this automatically — manual retry may be required.`,
        detail: `Error: ${reason}`,
      }).catch(() => {})
    }
  }
}
