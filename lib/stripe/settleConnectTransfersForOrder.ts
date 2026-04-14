import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getOrderById } from '@/lib/supabaseClient'

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
        '[connect-settlement] seller not ready for transfers; skipping',
        orderId,
        sellerUserAccountId
      )
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

      const { error: insErr } = await client.from('order_connect_transfer').insert({
        user_order_id: orderId,
        seller_user_account_id: sellerUserAccountId,
        amount_cents: amountCents,
        currency,
        stripe_transfer_id: transfer.id,
        stripe_charge_id: chargeId,
      })

      if (insErr) {
        console.error('[connect-settlement] insert order_connect_transfer', orderId, sellerUserAccountId, insErr)
      }
    } catch (e) {
      console.error('[connect-settlement] transfers.create failed', orderId, sellerUserAccountId, e)
    }
  }
}
