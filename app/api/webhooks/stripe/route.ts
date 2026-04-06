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

function shippingAddressFromSession(session: Stripe.Checkout.Session): ShippingAddressRow | null {
  const addr =
    session.collected_information?.shipping_details?.address ??
    session.customer_details?.address ??
    null
  if (!addr || typeof addr !== 'object') return null
  return {
    line1: addr.line1 ?? null,
    line2: addr.line2 ?? null,
    city: addr.city ?? null,
    state: addr.state ?? null,
    postal_code: addr.postal_code ?? null,
    country: addr.country ?? null,
  }
}

/**
 * Stripe webhook: checkout.session.completed (orders + subscriptions), customer.subscription.deleted.
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
