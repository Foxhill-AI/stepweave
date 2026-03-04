import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { updateOrderPaid, type OrderWithItemsRow } from '@/lib/supabaseClient'

const ORDER_COLUMNS = 'id, user_account_id, total_amount, currency, status, paid_at, created_at, updated_at, shipping_address'

/**
 * GET /api/order/confirmation?session_id=cs_...
 * Returns the order for the given Stripe Checkout session_id if the current user owns it.
 * Uses SUPABASE_SERVICE_ROLE_KEY when set (bypasses RLS); otherwise uses the server client
 * (user JWT), which requires the "Users can select own orders" RLS policy on user_order.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id')
  if (!sessionId || sessionId.trim() === '') {
    return NextResponse.json(
      { error: 'Missing session_id' },
      { status: 400 }
    )
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !authUser) {
    console.warn('[order/confirmation] No auth:', authError?.message ?? 'no user')
    return NextResponse.json(
      { error: 'You must be signed in to view this order' },
      { status: 401 }
    )
  }

  const { data: userAccount } = await supabase
    .from('user_account')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()
  if (!userAccount?.id) {
    console.warn('[order/confirmation] No user_account for auth user')
    return NextResponse.json(
      { error: 'User account not found' },
      { status: 403 }
    )
  }
  const userAccountId = userAccount.id as number

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const db = supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : supabase
  const usingServiceRole = Boolean(serviceRoleKey)
  if (!serviceRoleKey) {
    console.info('[order/confirmation] Using server client (RLS applies). user_account_id=%s', userAccountId)
  }

  // Fetch order without nested order_item first; RLS on order_item can cause the whole row to be hidden.
  const { data: order, error: orderError } = await db
    .from('user_order')
    .select(ORDER_COLUMNS)
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle()

  if (orderError) {
    console.error('[order/confirmation] Order query error:', orderError)
    return NextResponse.json(
      { error: 'Failed to load order' },
      { status: 500 }
    )
  }
  if (!order) {
    console.warn('[order/confirmation] No order for session_id (user_account_id=%s)', userAccountId)
    return NextResponse.json(
      { error: 'Order not found or session expired' },
      {
        status: 404,
        headers: {
          'X-Confirmation-Debug': `no-order,usingServiceRole=${usingServiceRole}`,
        },
      }
    )
  }

  if ((order as { user_account_id: number }).user_account_id !== userAccountId) {
    return NextResponse.json(
      { error: 'You do not have access to this order' },
      { status: 403 }
    )
  }

  // Fetch order items in a separate query (avoids RLS on order_item blocking the parent row).
  const orderId = (order as { id: number }).id
  const orderRow = order as OrderWithItemsRow & { status: string; paid_at: string | null; shipping_address: OrderWithItemsRow['shipping_address'] }
  const { data: orderItems } = await db
    .from('order_item')
    .select('id, order_id, product_id, product_variant_id, product_name, variant_label, quantity, unit_price, subtotal, stripe_price_id, created_at')
    .eq('order_id', orderId)

  // User reached confirmation from Stripe success_url, so payment succeeded. Mark order as paid if still pending
  // (webhook may not run in local dev, so this ensures Order History shows Completed).
  const now = new Date().toISOString()
  if (orderRow.status === 'pending') {
    await updateOrderPaid(orderId, db, orderRow.shipping_address ?? undefined)
    orderRow.status = 'paid'
    orderRow.paid_at = now
  }

  const orderWithItems: OrderWithItemsRow = {
    ...orderRow,
    order_item: (orderItems ?? []) as OrderWithItemsRow['order_item'],
  }
  return NextResponse.json(orderWithItems)
}
