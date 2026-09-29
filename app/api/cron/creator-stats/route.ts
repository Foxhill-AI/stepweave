import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendCreatorStatsEmail } from '@/lib/email'

/**
 * GET /api/cron/creator-stats
 *
 * Runs daily at 9am CT (14:00 UTC) via Vercel Cron.
 * Finds all active products that became active ~7 days ago and haven't
 * had a 7-day stats email sent yet, then sends one to each creator.
 *
 * Protected by CRON_SECRET header (set in Vercel env vars).
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

  // Products that went active between 7d+1h ago and 7d-1h ago (2h window to tolerate cron drift)
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const windowStart = new Date(sevenDaysAgo.getTime() - 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(sevenDaysAgo.getTime() + 60 * 60 * 1000).toISOString()

  const { data: products, error: productsErr } = await admin
    .from('product')
    .select(`
      id,
      name,
      user_account_id,
      created_at,
      user_account!inner (
        id,
        auth_user_id
      )
    `)
    .eq('status', 'active')
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)

  if (productsErr) {
    console.error('[cron/creator-stats] fetch products', productsErr)
    return NextResponse.json({ error: productsErr.message }, { status: 500 })
  }

  if (!products || products.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 })
  }

  const productIds = products.map((p) => p.id as number)

  // Check which ones already had the email sent
  const { data: alreadySent } = await admin
    .from('product_stats_email')
    .select('product_id')
    .in('product_id', productIds)
    .eq('email_type', '7day')

  const sentSet = new Set((alreadySent ?? []).map((r) => r.product_id as number))
  const toSend = products.filter((p) => !sentSet.has(p.id as number))

  let sent = 0
  let skipped = sentSet.size

  for (const product of toSend) {
    const userAccount = product.user_account as unknown as { id: number; auth_user_id: string } | null
    if (!userAccount) { skipped++; continue }

    // Get creator's email from Supabase Auth
    const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userAccount.auth_user_id)
    if (authErr || !authUser?.user?.email) {
      console.warn('[cron/creator-stats] could not get email for user_account', userAccount.id)
      skipped++
      continue
    }
    const creatorEmail = authUser.user.email

    // Get username
    const { data: accountRow } = await admin
      .from('user_account')
      .select('username')
      .eq('id', userAccount.id)
      .maybeSingle()
    const username = (accountRow?.username as string | null) ?? 'there'

    // Gather stats in parallel
    const [likesRes, viewsRes, ordersRes] = await Promise.all([
      admin
        .from('product_interaction')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', product.id)
        .eq('interaction_type', 'like'),
      admin
        .from('product_interaction')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', product.id)
        .eq('interaction_type', 'view'),
      admin
        .from('order_item')
        .select('quantity, seller_net_amount')
        .eq('product_id', product.id),
    ])

    const likes = likesRes.count ?? 0
    const views = viewsRes.count ?? 0
    const orderItems = (ordersRes.data ?? []) as { quantity: number; seller_net_amount: number | null }[]
    const orders = orderItems.reduce((sum, item) => sum + (item.quantity ?? 1), 0)
    const revenueEarned = orderItems.reduce((sum, item) => sum + Number(item.seller_net_amount ?? 0), 0)

    const result = await sendCreatorStatsEmail({
      to: creatorEmail,
      username,
      productName: product.name as string,
      productId: product.id as number,
      views,
      likes,
      orders,
      revenueEarned,
      currency: 'USD',
    })

    if (result.ok) {
      // Mark as sent
      await admin.from('product_stats_email').upsert(
        { product_id: product.id, email_type: '7day', sent_at: new Date().toISOString() },
        { onConflict: 'product_id,email_type' }
      )
      sent++
    } else {
      console.error('[cron/creator-stats] email failed for product', product.id, result.error)
      skipped++
    }
  }

  console.info('[cron/creator-stats] done', { sent, skipped })
  return NextResponse.json({ sent, skipped })
}
