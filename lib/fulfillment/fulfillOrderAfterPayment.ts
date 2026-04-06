import type { SupabaseClient } from '@supabase/supabase-js'

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
  if (status !== 'pending' && status !== 'failed') {
    return { ok: true, skipped: true }
  }

  // Phase 4: build Printful payload from order_item.design_snapshot and POST /orders
  console.info('[fulfillment] Printful submit not implemented yet; order', orderId)
  return { ok: true, skipped: true }
}
