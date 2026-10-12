import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendAdminAlert, sendWeeklyAdminReport } from '@/lib/email'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/weekly-admin-report
 *
 * Runs every Monday at 5:00 AM UTC via Vercel Cron.
 * Sends a weekly summary to ADMIN_ALERT_EMAIL with:
 *   - New user signups (last 7 days)
 *   - Products published (last 7 days)
 *   - Orders placed (last 7 days)
 *   - Total revenue (last 7 days, paid orders only)
 *
 * Protected by CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  try {
    return await handler(request)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    console.error('[cron/weekly-admin-report] top-level crash', e)
    sendAdminAlert({
      subject: 'Cron crashed: weekly-admin-report',
      title: 'weekly-admin-report cron crashed',
      body: 'The weekly admin report cron threw an unexpected error. No report was sent.',
      detail: `Error: ${reason}`,
    }).catch(() => {})
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function handler(request: NextRequest) {
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

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const since = sevenDaysAgo.toISOString()

  // New user signups
  const { count: newUsers } = await admin
    .from('user_account')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)

  // Products published (status = active, created in window)
  const { count: newProducts } = await admin
    .from('product')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .gte('created_at', since)

  // Orders placed (paid only — excludes abandoned/unpaid rows)
  const { count: newOrders } = await admin
    .from('user_order')
    .select('id', { count: 'exact', head: true })
    .in('status', ['paid', 'fulfilled', 'shipped', 'delivered'])
    .gte('paid_at', since)

  // Revenue + order details (buyer, products, amount)
  const { data: revenueRows } = await admin
    .from('user_order')
    .select(`
      id,
      total_amount,
      paid_at,
      user_account:user_account_id ( username, email ),
      user_order_item ( quantity, unit_price, product:product_id ( name ) )
    `)
    .in('status', ['paid', 'fulfilled', 'shipped', 'delivered'])
    .gte('paid_at', since)
    .order('paid_at', { ascending: false })

  const totalRevenue = (revenueRows ?? []).reduce(
    (sum, row) => sum + Number(row.total_amount ?? 0),
    0
  )

  type OrderDetail = {
    id: number
    buyer: string
    items: string
    amount: number
    paidAt: string
  }
  const orderDetails: OrderDetail[] = (revenueRows ?? []).map((row) => {
    const r = row as unknown as {
      id: number
      total_amount: number | null
      paid_at: string | null
      user_account: { username?: string; email?: string } | null
      user_order_item: Array<{ quantity: number; unit_price: number; product: { name: string } | null }> | null
    }
    const buyer = r.user_account?.username ?? r.user_account?.email ?? 'Unknown'
    const items = (r.user_order_item ?? [])
      .map((i) => `${i.product?.name ?? 'Unknown product'}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`)
      .join(', ') || 'No items'
    return {
      id: r.id,
      buyer,
      items,
      amount: Number(r.total_amount ?? 0),
      paidAt: r.paid_at ? new Date(r.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
    }
  })

  const weekStart = sevenDaysAgo.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const weekEnd = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const weekLabel = `${weekStart} – ${weekEnd}`

  const result = await sendWeeklyAdminReport({
    weekLabel,
    newUsers: newUsers ?? 0,
    newProducts: newProducts ?? 0,
    newOrders: newOrders ?? 0,
    totalRevenue,
    orderDetails,
  })

  if (!result.ok) {
    console.error('[cron/weekly-admin-report] email send failed:', result.error)
    return NextResponse.json({ error: 'Email send failed', detail: result.error }, { status: 500 })
  }

  console.log('[cron/weekly-admin-report] sent', {
    newUsers,
    newProducts,
    newOrders,
    totalRevenue,
  })

  return NextResponse.json({
    ok: true,
    newUsers: newUsers ?? 0,
    newProducts: newProducts ?? 0,
    newOrders: newOrders ?? 0,
    totalRevenue,
  })
}
