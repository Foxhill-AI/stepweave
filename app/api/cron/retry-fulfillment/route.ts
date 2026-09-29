import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fulfillOrderAfterPayment } from '@/lib/fulfillment/fulfillOrderAfterPayment'

/**
 * GET /api/cron/retry-fulfillment
 *
 * Runs daily at 14:10 UTC via Vercel Cron.
 * Finds all paid orders with fulfillment_status = 'failed' and no printful_order_id,
 * then retries them. If Printful rejects again, the existing alert email fires again
 * via persistFulfillmentFailure so the admin stays informed.
 *
 * Protected by CRON_SECRET header.
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
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  // Find paid orders that failed fulfillment and haven't been submitted to Printful yet
  const { data: orders, error: fetchErr } = await admin
    .from('user_order')
    .select('id')
    .eq('status', 'paid')
    .eq('fulfillment_status', 'failed')
    .is('printful_order_id', null)
    .order('created_at', { ascending: true })

  if (fetchErr) {
    console.error('[cron/retry-fulfillment] fetch error', fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json({ retried: 0, succeeded: 0, failed: 0 })
  }

  let succeeded = 0
  let failed = 0

  for (const row of orders) {
    const orderId = row.id as number

    // Reset to failed so fulfillOrderAfterPayment treats it as retriable
    await admin
      .from('user_order')
      .update({ fulfillment_status: 'failed', fulfillment_last_error: null })
      .eq('id', orderId)

    const result = await fulfillOrderAfterPayment(orderId, admin)

    if (result.ok && !result.skipped) {
      console.info('[cron/retry-fulfillment] succeeded', orderId)
      succeeded++
    } else if (result.skipped) {
      // Already fulfilled somehow — count as success
      succeeded++
    } else {
      console.warn('[cron/retry-fulfillment] still failing', orderId)
      failed++
    }
  }

  console.info('[cron/retry-fulfillment] done', { total: orders.length, succeeded, failed })
  return NextResponse.json({ retried: orders.length, succeeded, failed })
}
