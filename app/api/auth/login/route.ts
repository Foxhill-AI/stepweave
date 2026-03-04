import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('HAS_ANON_KEY:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      const msg = error.message.toLowerCase()
      if (
        msg.includes('confirm') ||
        msg.includes('verified') ||
        msg.includes('email_not_confirmed')
      ) {
        return NextResponse.json(
          {
            error:
              'Please verify your email first. Check your inbox, or resend the verification email.',
          },
          { status: 403 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { user: data.user ? { id: data.user.id, email: data.user.email } : null },
      { status: 200 }
    )
  } catch (err) {
    console.error('[api/auth/login]', err)
    return NextResponse.json(
      { error: 'An error occurred during sign in' },
      { status: 500 }
    )
  }
}
