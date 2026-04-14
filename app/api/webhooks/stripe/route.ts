import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import {
  updateOrderPaid,
  getOrderById,
  claimStripeWebhookEvent,
  markStripeWebhookEventProcessed,
  isStripeWebhookEventFullyProcessed,
  type ShippingAddressRow,
} from '@/lib/supabaseClient'
import { sendOrderConfirmationEmail, sendSubscriptionEndedEmail } from '@/lib/email'
import { fulfillOrderAfterPayment } from '@/lib/fulfillment/fulfillOrderAfterPayment'
import { settleConnectTransfersForOrder } from '@/lib/stripe/settleConnectTransfersForOrder'

function shippingAddressFromSession(session: Stripe.Checkout.Session): ShippingAddressRow | null {
  /** Stripe typings omit `shipping_details` on Session in some API versions; it exists at runtime. */
  const sessionExt = session as Stripe.Checkout.Session & {
    shipping_details?: { name?: string | null; address?: Stripe.Address | null } | null
  }
  const shippingDetails =
    session.collected_information?.shipping_details ?? sessionExt.shipping_details ?? null
  const addr =
    shippingDetails?.address ??
    session.customer_details?.address ??
    null
  if (!addr || typeof addr !== 'object') return null
  const nameFromShipping =
    shippingDetails && typeof shippingDetails === 'object' && 'name' in shippingDetails
      ? (shippingDetails as { name?: string | null }).name
      : null
  const name =
    (typeof nameFromShipping === 'string' && nameFromShipping.trim()
      ? nameFromShipping.trim()
      : null) ??
    (typeof session.customer_details?.name === 'string' && session.customer_details.name.trim()
      ? session.customer_details.name.trim()
      : null)
  const email =
    typeof session.customer_details?.email === 'string' && session.customer_details.email.trim()
      ? session.customer_details.email.trim()
      : null
  const phone =
    typeof session.customer_details?.phone === 'string' && session.customer_details.phone.trim()
      ? session.customer_details.phone.trim()
      : null
  return {
    line1: addr.line1 ?? null,
    line2: addr.line2 ?? null,
    city: addr.city ?? null,
    state: addr.state ?? null,
    postal_code: addr.postal_code ?? null,
    country: addr.country ?? null,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  }
}

/**
 * Stripe webhook: checkout.session.completed (orders + subscriptions), customer.subscription.deleted,
 * account.updated (Connect Express onboarding flags). Product orders: after pay, Connect Transfers to sellers (Phase 3).
 * Idempotencia: tabla stripe_webhook_event (evt_…); reintentos si processed_at es null.
 *
 * Requiere STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, y SUPABASE_SERVICE_ROLE_KEY (recomendado).
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('Stripe webhook: STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 503 }
    )
  }

  let event: Stripe.Event
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY
  if (!stripeSecret) {
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 503 }
    )
  }

  try {
    const stripe = new Stripe(stripeSecret)
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    console.error('Stripe webhook signature verification failed:', message)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || (!serviceRoleKey && !anonKey)) {
    console.error('Stripe webhook: Supabase env vars missing')
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 503 }
    )
  }

  const client = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, anonKey!)

  /** Eventos que persistimos en stripe_webhook_event */
  const trackedTypes =
    event.type === 'customer.subscription.deleted' || event.type === 'checkout.session.completed'

  if (trackedTypes) {
    const claim = await claimStripeWebhookEvent(event.id, event.type, client)
    if (claim.dbError) {
      return NextResponse.json({ error: 'Database error' }, { status: 503 })
    }
    if (!claim.inserted && claim.duplicate) {
      const alreadyDone = await isStripeWebhookEventFullyProcessed(event.id, client)
      if (alreadyDone) {
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
      }
    }
  }

  // ——— Subscription ended ———
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const subId = subscription.id
    const { data: subRow } = await client
      .from('user_subscription')
      .select('user_account_id')
      .eq('stripe_subscription_id', subId)
      .maybeSingle()
    if (!subRow?.user_account_id) {
      await markStripeWebhookEventProcessed(event.id, client, null)
      return NextResponse.json({ received: true }, { status: 200 })
    }
    const userAccountId = subRow.user_account_id as number
    const { data: account } = await client
      .from('user_account')
      .select('pending_tier')
      .eq('id', userAccountId)
      .single()
    const newTier =
      account?.pending_tier === 'starter' || account?.pending_tier === 'free'
        ? account.pending_tier
        : 'free'
    await client
      .from('user_account')
      .update({
        subscription_tier: newTier,
        pending_tier: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userAccountId)
    await client
      .from('user_subscription')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subId)

    if (stripeSecret && typeof subscription.customer === 'string') {
      try {
        const stripe = new Stripe(stripeSecret)
        const customer = await stripe.customers.retrieve(subscription.customer)
        const email = customer && !customer.deleted && 'email' in customer ? customer.email : null
        if (email && email.trim()) {
          await sendSubscriptionEndedEmail({ to: email.trim(), newTier })
        }
      } catch (e) {
        console.warn('Stripe webhook: could not send subscription ended email', e)
      }
    }
    await markStripeWebhookEventProcessed(event.id, client, null)
    return NextResponse.json({ received: true, subscription_deleted: true }, { status: 200 })
  }

  // ——— Stripe Connect (Express) account updates ———
  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account
    const acctId = account.id
    const metaRaw = account.metadata?.user_account_id
    let userAccountId: number | null = null
    if (metaRaw != null && String(metaRaw).trim() !== '') {
      const n = Number(metaRaw)
      if (Number.isInteger(n) && n > 0) userAccountId = n
    }
    if (userAccountId == null && acctId) {
      const { data: byAcct } = await client
        .from('user_account')
        .select('id')
        .eq('stripe_connect_account_id', acctId)
        .maybeSingle()
      if (byAcct?.id != null) userAccountId = byAcct.id as number
    }
    if (userAccountId == null) {
      console.warn('Stripe webhook: account.updated could not resolve user_account_id', acctId)
      await markStripeWebhookEventProcessed(event.id, client, null)
      return NextResponse.json({ received: true, connect: 'unmapped' }, { status: 200 })
    }

    const charges = Boolean(account.charges_enabled)
    const payouts = Boolean(account.payouts_enabled)
    const details = Boolean(account.details_submitted)
    const now = new Date().toISOString()

    const { data: before } = await client
      .from('user_account')
      .select('stripe_connect_onboarding_completed_at')
      .eq('id', userAccountId)
      .maybeSingle()
    const wasComplete = Boolean(before?.stripe_connect_onboarding_completed_at)
    const nowComplete = charges && payouts

    const patch: Record<string, unknown> = {
      stripe_connect_account_id: acctId,
      stripe_connect_charges_enabled: charges,
      stripe_connect_payouts_enabled: payouts,
      stripe_connect_details_submitted: details,
      stripe_connect_last_synced_at: now,
      updated_at: now,
    }
    if (nowComplete && !wasComplete) {
      patch.stripe_connect_onboarding_completed_at = now
    }

    const { error: connectUpdateError } = await client.from('user_account').update(patch).eq('id', userAccountId)
    if (connectUpdateError) {
      console.error('Stripe webhook: account.updated user_account update failed', connectUpdateError)
      return NextResponse.json({ error: 'Failed to update Connect status' }, { status: 500 })
    }
    await markStripeWebhookEventProcessed(event.id, client, null)
    return NextResponse.json({ received: true, connect: true, user_account_id: userAccountId }, { status: 200 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const session = event.data.object as Stripe.Checkout.Session

  // ——— Subscription checkout (Become a Creator) ———
  if (session.mode === 'subscription') {
    const userAccountIdRaw = session.metadata?.user_account_id
    const tier = session.metadata?.tier
    if (!userAccountIdRaw || (tier !== 'starter' && tier !== 'pro')) {
      console.error('Stripe webhook: subscription session missing user_account_id or tier')
      await markStripeWebhookEventProcessed(event.id, client, null, 'missing creator metadata')
      return NextResponse.json(
        { error: 'Missing creator metadata' },
        { status: 400 }
      )
    }
    const userAccountId = Number(userAccountIdRaw)
    if (!Number.isInteger(userAccountId) || userAccountId <= 0) {
      await markStripeWebhookEventProcessed(event.id, client, null, 'invalid user_account_id')
      return NextResponse.json(
        { error: 'Invalid user_account_id' },
        { status: 400 }
      )
    }
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    if (!subscriptionId || !customerId) {
      console.error('Stripe webhook: subscription session missing subscription or customer id')
      await markStripeWebhookEventProcessed(event.id, client, null, 'missing subscription or customer')
      return NextResponse.json(
        { error: 'Missing subscription or customer' },
        { status: 400 }
      )
    }
    const stripe = new Stripe(stripeSecret)
    let currentPeriodEnd: string | null = null
    try {
      const sub = (await stripe.subscriptions.retrieve(subscriptionId)) as {
        current_period_end?: number
      }
      if (sub.current_period_end) currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString()
    } catch (e) {
      console.warn('Stripe webhook: could not retrieve subscription for period_end', e)
    }
    const { error: updateTierError } = await client
      .from('user_account')
      .update({
        subscription_tier: tier,
        pending_tier: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userAccountId)
    if (updateTierError) {
      console.error('Stripe webhook: update user_account subscription_tier failed', updateTierError)
      return NextResponse.json(
        { error: 'Failed to update subscription tier' },
        { status: 500 }
      )
    }
    const { error: upsertSubError } = await client
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
        {
          onConflict: 'user_account_id,provider',
          ignoreDuplicates: false,
        }
      )
    if (upsertSubError) {
      console.error('Stripe webhook: upsert user_subscription failed', upsertSubError)
    }
    await markStripeWebhookEventProcessed(event.id, client, null)
    return NextResponse.json(
      { received: true, subscription: true, user_account_id: userAccountId },
      { status: 200 }
    )
  }

  // ——— One-time payment (product order) ———
  const orderIdRaw = session.metadata?.order_id
  if (!orderIdRaw) {
    console.error('Stripe webhook: checkout.session.completed without metadata.order_id')
    await markStripeWebhookEventProcessed(event.id, client, null, 'missing order_id metadata')
    return NextResponse.json(
      { error: 'Missing order_id in session metadata' },
      { status: 400 }
    )
  }

  const orderId = Number(orderIdRaw)
  if (!Number.isInteger(orderId) || orderId <= 0) {
    await markStripeWebhookEventProcessed(event.id, client, null, 'invalid order_id')
    return NextResponse.json(
      { error: 'Invalid order_id in session metadata' },
      { status: 400 }
    )
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent && typeof session.payment_intent === 'object'
        ? session.payment_intent.id
        : null
  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer && typeof session.customer === 'object'
        ? session.customer.id
        : null

  const { data: orderBefore } = await client
    .from('user_order')
    .select('status')
    .eq('id', orderId)
    .maybeSingle()
  const wasAlreadyPaid = String(orderBefore?.status ?? '') === 'paid'

  const shippingAddress = shippingAddressFromSession(session)
  const updated = await updateOrderPaid(orderId, client, shippingAddress, {
    stripePaymentIntentId: paymentIntentId,
    stripeCustomerId: customerId,
    expectedStripeCheckoutSessionId: session.id,
  })
  if (!updated) {
    console.error('Stripe webhook: updateOrderPaid failed for orderId', orderId)
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }

  try {
    const stripeForConnect = new Stripe(stripeSecret)
    await settleConnectTransfersForOrder(orderId, stripeForConnect, client, paymentIntentId)
  } catch (e) {
    console.error('Stripe webhook: settleConnectTransfersForOrder', e)
  }

  try {
    await fulfillOrderAfterPayment(orderId, client)
  } catch (e) {
    console.error('Stripe webhook: fulfillOrderAfterPayment', e)
  }

  const customerEmail =
    session.customer_details?.email ?? (session as { customer_email?: string }).customer_email ?? null
  if (!wasAlreadyPaid && customerEmail && customerEmail.trim()) {
    const order = await getOrderById(orderId, client)
    if (order) {
      const result = await sendOrderConfirmationEmail({
        to: customerEmail,
        order,
        sessionId: session.id,
      })
      if (!result.ok) {
        console.error('Stripe webhook: order confirmation email failed', result.error)
      }
    }
  }

  await markStripeWebhookEventProcessed(event.id, client, orderId)
  return NextResponse.json({ received: true, orderId }, { status: 200 })
}
