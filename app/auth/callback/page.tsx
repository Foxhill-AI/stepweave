'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// Guard at module scope so only one exchange runs per page load (survives Strict Mode remount).
let authExchangeStarted = false

function AuthCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState<string>('Signing you in…')

  useEffect(() => {
    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    const hash = typeof window !== 'undefined' ? window.location.hash : ''

    if (errorParam) {
      setMessage(errorDescription || errorParam || 'Sign-in failed.')
      router.replace('/')
      return
    }

    if (code) {
      if (authExchangeStarted) {
        router.replace('/')
        return
      }
      authExchangeStarted = true

      let cancelled = false
      const timeoutId = setTimeout(() => {
        if (cancelled) return
        cancelled = true
        setMessage('Sign-in timed out. Please try again.')
        router.replace('/')
      }, 15000)

      // Exchange in client so PKCE code_verifier is available; createBrowserClient writes session to cookies.
      supabase.auth
        .exchangeCodeForSession(code)
        .then(() => {
          if (cancelled) return
          let fallbackId: ReturnType<typeof setTimeout> | null = null
          const goHome = () => {
            if (cancelled) return
            cancelled = true
            clearTimeout(timeoutId)
            if (fallbackId != null) clearTimeout(fallbackId)
            router.replace('/')
          }
          if (typeof window !== 'undefined') {
            window.addEventListener('auth-ready', goHome, { once: true })
          }
          fallbackId = setTimeout(goHome, 3000)
        })
        .catch((err) => {
          if (cancelled) return
          cancelled = true
          clearTimeout(timeoutId)
          setMessage(err?.message || 'Sign-in failed.')
          router.replace('/')
        })

      return () => {
        cancelled = true
        clearTimeout(timeoutId)
      }
    }

    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = window.location.hash
      const isRecovery = hashParams.includes('type=recovery')
      if (isRecovery) {
        document.cookie = 'recovery_pending=1; path=/; max-age=900'
        setMessage('Redirecting to reset password…')
        const t = setTimeout(() => router.replace('/auth/reset-password'), 1500)
        return () => clearTimeout(t)
      }
      setMessage('Confirming your email…')
      const t = setTimeout(() => router.replace('/'), 2000)
      return () => clearTimeout(t)
    }

    setMessage('Redirecting…')
    router.replace('/')
  }, [searchParams, router])

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>{message}</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}><p>Loading…</p></div>}>
      <AuthCallbackInner />
    </Suspense>
  )
}
