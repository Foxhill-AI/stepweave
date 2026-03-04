import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // #region agent log
  const _log = (msg: string, data: Record<string, unknown>, hypothesisId: string) => {
    fetch('http://127.0.0.1:7242/ingest/d5b7cdc8-b289-418a-ad08-7496640487f1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/auth/exchange-code/route.ts',message:msg,data,timestamp:Date.now(),hypothesisId})}).catch(()=>{});
  };
  // #endregion
  try {
    const body = await request.json().catch(() => ({}))
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const bodyKeys = Object.keys(body || {})

    // #region agent log
    _log('exchange-code entry', { bodyKeys, hasCode: !!code, codeLength: code.length }, 'H1');
    // #endregion

    if (!code) {
      _log('400 missing code', {}, 'H1');
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      // #region agent log
      _log('400 Supabase error', { errorMessage: error.message, errorName: (error as { name?: string }).name }, 'H2');
      // #endregion
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // #region agent log
    _log('200 success', { hasUser: !!data?.user }, 'H4');
    // #endregion
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
