import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendOrderShippedEmail } from '@/lib/email'

/**
 * POST /api/webhooks/printful
 *
 * Handles Printful webhook events:
 *   - package_shipped  → update order status, send shipped email with tracking
 *
 * Register this URL in Printful dashboard:
 *   Settings → Webhooks → Add endpoint → https://www.stepweave.com/api/webhooks/printful
 * Select events: Package shipped
 *
 * Printful does not sign webhooks with a secret by default (unlike Stripe).
 * We verify by checking the printful_order_id exists in our DB before acting.
 */

type PrintfulShipment = {
  id?: number
  tracking_number?: string | null
  tracking_url?: string | null
  carrier?: string | null
  service?: string | null
}

type PrintfulWebhookBody = {
  type?: string
  data?: {
    order?: {
      id?: number | string
      external_id?: string | null
      status?: string
      shipments?: PrintfulShipment[]
    }
    shipment?: PrintfulShipment
  }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[printful-webhook] Missing Supabase env vars')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  let body: PrintfulWebhookBody
  try {
    body = (await request.json()) as PrintfulWebhookBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = body.type
  console.info('[printful-webhook] received', eventType)

  if (eventType !== 'package_shipped') {
    // Acknowledge other events without acting
    return NextResponse.json({ received: true })
  }

  const printfulOrderId = String(body.data?.order?.id ?? '').trim()
  const externalId = String(body.data?.order?.external_id ?? '').trim()

  if (!printfulOrderId && !externalId) {
    console.warn('[printful-webhook] package_shipped missing order id')
    return NextResponse.json({ received: true })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  // Look up our order by printful_order_id or external_id (stepweave-order-{id})
  let orderQuery = admin
    .from('user_order')
    .select('id, fulfillment_status, shipping_address')

  if (printfulOrderId) {
    orderQuery = orderQuery.eq('printful_order_id', printfulOrderId)
  } else {
    // external_id format: stepweave-order-{id}
    const match = externalId.match(/stepweave-order-(\d+)/)
    if (!match) {
      console.warn('[printful-webhook] unrecognised external_id', externalId)
      return NextResponse.json({ received: true })
    }
    orderQuery = orderQuery.eq('id', Number(match[1]))
  }

  const { data: orderRow, error: orderErr } = await orderQuery.maybeSingle()
  if (orderErr || !orderRow) {
    console.warn('[printful-webhook] order not found', { printfulOrderId, externalId })
    return NextResponse.json({ received: true })
  }

  // Extract tracking info — prefer top-level shipment, fall back to first in array
  const shipment: PrintfulShipment =
    body.data?.shipment ?? body.data?.order?.shipments?.[0] ?? {}
  const trackingNumber = shipment.tracking_number ?? null
  const trackingUrl = shipment.tracking_url ?? null
  const carrier = shipment.carrier ?? shipment.service ?? null

  // Update order status
  await admin
    .from('user_order')
    .update({
      fulfillment_status: 'shipped',
      ...(trackingNumber ? { order_metadata: { tracking_number: trackingNumber, tracking_url: trackingUrl, carrier } } : {}),
    })
    .eq('id', orderRow.id)

  // Send shipped email — get customer email from shipping address
  const shippingAddr = orderRow.shipping_address as { email?: string; name?: string } | null
  const customerEmail = shippingAddr?.email?.trim()

  if (customerEmail) {
    const result = await sendOrderShippedEmail({
      to: customerEmail,
      orderNumber: orderRow.id as number,
      trackingNumber,
      trackingUrl,
      carrier,
    })
    if (!result.ok) {
      console.error('[printful-webhook] shipped email failed', result.error)
    }
  } else {
    console.warn('[printful-webhook] no customer email on order', orderRow.id)
  }

  return NextResponse.json({ received: true })
}
