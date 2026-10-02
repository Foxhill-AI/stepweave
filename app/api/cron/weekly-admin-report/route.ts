import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendAdminAlert, sendWeeklyAdminReport } from '@/lib/email'

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

  // Orders placed
  const { count: newOrders } = await admin
    .from('user_order')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)

  // Revenue from paid orders (status = paid, fulfilled, or shipped)
  const { data: revenueRows } = await admin
    .from('user_order')
    .select('total_amount')
    .in('status', ['paid', 'fulfilled', 'shipped', 'delivered'])
    .gte('paid_at', since)

  const totalRevenue = (revenueRows ?? []).reduce(
    (sum, row) => sum + Number(row.total_amount ?? 0),
    0
  )

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
