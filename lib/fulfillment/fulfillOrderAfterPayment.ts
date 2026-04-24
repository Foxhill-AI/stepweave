import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getOrderById,
  type DesignDraftSnapshotPayload,
  type ShippingAddressRow,
} from '@/lib/supabaseClient'
import { prepareOrderPrintFilesFromSnapshot } from '@/lib/printful/prepareOrderPrintFiles'
import {
  submitPrintfulOrder,
  type PrintfulSubmitRecipient,
  type PrintfulOrderLineItem,
} from '@/lib/printful/submitPrintfulOrder'

function isDesignSnapshotPayload(raw: unknown): raw is DesignDraftSnapshotPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const o = raw as Record<string, unknown>
  const bm = o.base_model_id
  if (bm == null || (typeof bm !== 'string' && typeof bm !== 'number')) return false
  const ds = o.design_state
  if (!ds || typeof ds !== 'object' || Array.isArray(ds)) return false
  return true
}

function recipientFromShipping(addr: ShippingAddressRow | null | undefined): PrintfulSubmitRecipient | null {
  if (!addr?.line1?.trim() || !addr.city?.trim() || !addr.country?.trim() || !addr.postal_code?.trim()) {
    return null
  }
  return {
    name: addr.name?.trim() || 'Customer',
    address1: addr.line1.trim(),
    ...(addr.line2?.trim() ? { address2: addr.line2.trim() } : {}),
    city: addr.city.trim(),
    state_code: (addr.state ?? '').trim(),
    country_code: String(addr.country).trim().toUpperCase().slice(0, 2),
    zip: addr.postal_code.trim(),
    ...(addr.phone?.trim() ? { phone: addr.phone.trim() } : {}),
    ...(addr.email?.trim() ? { email: addr.email.trim() } : {}),
  }
}

function shouldAutoConfirmPrintfulOrder(): boolean {
  const v = process.env.PRINTFUL_ORDER_AUTO_CONFIRM?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

/**
 * After Stripe marks an order paid, submit to Printful (Phase 4).
 * Idempotent: skips if printful_order_id exists or fulfillment already advanced.
 */
export async function fulfillOrderAfterPayment(
  orderId: number,
  client: SupabaseClient
): Promise<{ ok: boolean; skipped: boolean }> {
  const { data: row, error } = await client
    .from('user_order')
    .select('id, fulfillment_status, printful_order_id')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !row) {
    console.error('fulfillOrderAfterPayment: load order', error)
    return { ok: false, skipped: false }
  }

  if (row.printful_order_id) {
    return { ok: true, skipped: true }
  }
  const status = String(row.fulfillment_status ?? '')
  // Treat null/empty as eligible (new rows may not set fulfillment_status yet).
  if (status !== '' && status !== 'pending' && status !== 'failed') {
    return { ok: true, skipped: true }
  }

  const order = await getOrderById(orderId, client)
  if (!order) {
    console.error('fulfillOrderAfterPayment: getOrderById returned null', orderId)
    return { ok: false, skipped: false }
  }

  const recipient = recipientFromShipping(order.shipping_address ?? null)
  if (!recipient) {
    const msg = 'Missing or incomplete shipping address for Printful'
    console.error('[fulfillment]', msg, orderId)
    await persistFulfillmentFailure(client, orderId, msg)
    return { ok: false, skipped: false }
  }

  const lineItems: PrintfulOrderLineItem[] = []
  for (const item of order.order_item ?? []) {
    const snap = item.design_snapshot
    if (!snap || !isDesignSnapshotPayload(snap)) continue

    const prepared = await prepareOrderPrintFilesFromSnapshot(
      snap,
      client,
      `order/${orderId}/item-${item.id}`
    )
    if (!prepared.ok) {
      const msg = `Line ${item.id}: ${prepared.reason}`
      console.error('[fulfillment]', msg)
      await persistFulfillmentFailure(client, orderId, msg)
      return { ok: false, skipped: false }
    }

    let variantId: number | null = null
    const ds = snap.design_state as Record<string, unknown>
    const vidRaw = ds.printful_variant_id
    if (typeof vidRaw === 'number' && Number.isFinite(vidRaw)) variantId = vidRaw
    else if (typeof vidRaw === 'string' && /^\d+$/.test(vidRaw)) variantId = parseInt(vidRaw, 10)

    if (variantId == null) {
      const msg = `Line item ${item.id}: missing Printful variant in snapshot`
      await persistFulfillmentFailure(client, orderId, msg)
      return { ok: false, skipped: false }
    }

    lineItems.push({
      variant_id: variantId,
      quantity: Math.max(1, item.quantity),
      files: prepared.files,
    })
  }

  if (lineItems.length === 0) {
    const msg = 'No line items with a valid design snapshot to send to Printful'
    console.warn('[fulfillment]', msg, orderId)
    await persistFulfillmentFailure(client, orderId, msg)
    return { ok: false, skipped: false }
  }

  const confirm = shouldAutoConfirmPrintfulOrder()
  const externalId = `stepweave-order-${orderId}`

  const submitted = await submitPrintfulOrder({
    externalId,
    recipient,
    items: lineItems,
    confirm,
  })

  if (!submitted.ok) {
    console.error('[fulfillment] Printful order failed', orderId, submitted.reason, submitted.raw)
    await persistFulfillmentFailure(client, orderId, submitted.reason)
    return { ok: false, skipped: false }
  }

  const { error: upErr } = await client
    .from('user_order')
    .update({
      printful_order_id: submitted.printfulOrderId,
      fulfillment_provider: 'printful',
      fulfillment_status: confirm ? 'submitted' : 'draft_printful',
      fulfillment_last_error: null,
      fulfillment_submitted_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (upErr) {
    console.error('[fulfillment] user_order update after Printful success', upErr)
    return { ok: false, skipped: false }
  }

  console.info('[fulfillment] Printful order created', {
    orderId,
    printfulOrderId: submitted.printfulOrderId,
    confirm,
  })
  return { ok: true, skipped: false }
}

async function persistFulfillmentFailure(
  client: SupabaseClient,
  orderId: number,
  message: string
): Promise<void> {
  const { error } = await client
    .from('user_order')
    .update({
      fulfillment_status: 'failed',
      fulfillment_last_error: message.slice(0, 2000),
    })
    .eq('id', orderId)
  if (error) {
    console.error('persistFulfillmentFailure:', error)
  }
}
