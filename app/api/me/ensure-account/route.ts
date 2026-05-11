import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * POST /api/me/ensure-account
 * Creates public.user_account for the authenticated Auth user if missing.
 * Uses the service role so it works even when RLS blocks anonymous inserts
 * (e.g. email sign-up with "Confirm email" enabled — no session until verified).
 *
 * Body (optional): { "username": "desired_name" }
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: 'Server misconfigured: missing Supabase service role' },
      { status: 500 }
    )
  }

  const admin = createClient(url, serviceKey)

  const { data: existing, error: selErr } = await admin
    .from('user_account')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 })
  }

  if (existing?.id != null) {
    return NextResponse.json({ ok: true, created: false })
  }

  let body: { username?: string } = {}
  try {
    body = (await request.json()) as { username?: string }
  } catch {
    /* empty body */
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined
  const fromMeta =
    typeof meta?.username === 'string' ? meta.username.trim() : ''
  const emailLocal = (user.email ?? '').split('@')[0] || 'user'

  let username =
    (typeof body.username === 'string' ? body.username.trim() : '') ||
    fromMeta ||
    emailLocal

  if (!username) username = 'user'

  const insertOnce = async (name: string) => {
    return admin.from('user_account').insert({
      auth_user_id: user.id,
      username: name.slice(0, 120),
    })
  }

  let { error: insErr } = await insertOnce(username)

  if (
    insErr &&
    (insErr.message?.toLowerCase().includes('unique') ||
      insErr.code === '23505')
  ) {
    const suffix = user.id.replace(/-/g, '').slice(-6)
    ;({ error: insErr } = await insertOnce(`${username}-${suffix}`))
  }

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, created: true })
}
