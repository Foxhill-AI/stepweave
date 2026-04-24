import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const code = typeof body.code === 'string' ? body.code.trim() : ''

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { user: data.user ? { id: data.user.id, email: data.user.email } : null },
      { status: 200 }
    )
  } catch (err) {
    console.error('[api/auth/exchange-code]', err)
    return NextResponse.json(
      { error: 'Failed to exchange code for session' },
      { status: 500 }
    )
  }
}
