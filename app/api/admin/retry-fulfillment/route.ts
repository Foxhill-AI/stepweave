import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fulfillOrderAfterPayment } from '@/lib/fulfillment/fulfillOrderAfterPayment'

/**
 * POST /api/admin/retry-fulfillment
 * Manually re-submit a paid order to Printful.
 * Protected by ADMIN_SECRET header.
 *
 * Body: { orderId: number }
 */
export async function POST(request: NextRequest) {
  const secret = process.env.ADMIN_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'ADMIN_SECRET not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('x-admin-secret')
  if (!authHeader || authHeader !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { orderId?: unknown }
  try {
    body = (await request.json()) as { orderId?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const orderId = Number(body.orderId)
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return NextResponse.json({ error: 'orderId must be a positive number' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase env vars not set' }, { status: 500 })
  }

  // Reset fulfillment_status to 'failed' so fulfillOrderAfterPayment treats it as retriable
  // (it skips if status is already submitted/draft_printful).
  const admin = createClient(supabaseUrl, serviceRoleKey)
  await admin
    .from('user_order')
    .update({ fulfillment_status: 'failed', fulfillment_last_error: null })
    .eq('id', orderId)

  const result = await fulfillOrderAfterPayment(orderId, admin)

  return NextResponse.json({ orderId, ...result })
}
