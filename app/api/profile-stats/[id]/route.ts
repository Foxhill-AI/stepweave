import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/profile-stats/[id]
 * Returns follower/following/product/likes stats for a user_account id.
 * Uses service-role client to bypass RLS on user_follow, so public profiles
 * show correct follower counts for all visitors (not just the account owner).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userAccountId = Number(id)
  if (Number.isNaN(userAccountId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const [followersRes, followingRes, productsRes, productIdsRes] = await Promise.all([
    admin.from('user_follow').select('follower_id', { count: 'exact', head: true }).eq('following_id', userAccountId),
    admin.from('user_follow').select('following_id', { count: 'exact', head: true }).eq('follower_id', userAccountId),
    admin.from('product').select('id', { count: 'exact', head: true }).eq('user_account_id', userAccountId).eq('status', 'active'),
    admin.from('product').select('id').eq('user_account_id', userAccountId),
  ])

  const productIds = (productIdsRes.data ?? []).map((p: { id: number }) => p.id)
  let likesReceived = 0
  if (productIds.length > 0) {
    const { count } = await admin
      .from('product_interaction')
      .select('id', { count: 'exact', head: true })
      .eq('interaction_type', 'like')
      .in('product_id', productIds)
    likesReceived = count ?? 0
  }

  return NextResponse.json({
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
    products: productsRes.count ?? 0,
    likesReceived,
  })
}
