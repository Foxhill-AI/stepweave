import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * GET /api/me/account
 * Returns the user_account row for the authenticated user.
 * Uses the service role key to bypass RLS, so the result is not
 * affected by JWT timing issues that occur right after OAuth login.
 */
export async function GET() {
  // Identify the caller from their session cookie (set by exchangeCodeForSession).
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Service role bypasses RLS — no JWT auth.uid() timing issues.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from('user_account')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ userAccount: data })
}
