'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import { supabase } from '@/lib/supabaseClient'
import '../reset-password.css'

const MIN_PASSWORD_LENGTH = 6

function clearRecoveryPending() {
  if (typeof document === 'undefined') return
  document.cookie = 'recovery_pending=; path=/; max-age=0'
}

function ResetPasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      let cancelled = false
      supabase.auth
        .exchangeCodeForSession(code)
        .then(() => {
          if (cancelled) return
          document.cookie = 'recovery_pending=1; path=/; max-age=900'
          setHasSession(true)
          setLoading(false)
          router.replace('/auth/reset-password', { scroll: false })
        })
        .catch(() => {
          if (!cancelled) {
            setLoading(false)
            setHasSession(false)
          }
        })
      return () => { cancelled = true }
    }
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) {
        setHasSession(!!session)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [searchParams, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    setSubmitLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        const msg = updateError.message.toLowerCase()
        if (msg.includes('expired') || msg.includes('invalid') || msg.includes('session')) {
          setError('This link has expired. Please request a new password reset link.')
          return
        }
        setError(updateError.message)
        return
      }
      clearRecoveryPending()
      router.replace('/profile')
    } finally {
      setSubmitLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="reset-password-wrapper">
        <Navbar />
        <Subnavbar />
        <main className="reset-password-main">
          <p className="reset-password-message">Loading…</p>
        </main>
        <Footer />
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="reset-password-wrapper">
        <Navbar />
        <Subnavbar />
        <main className="reset-password-main">
          <div className="reset-password-card">
            <h1 className="reset-password-title">Link expired or invalid</h1>
            <p className="reset-password-text">
              This password reset link has expired or was already used. Request a new one to try again.
            </p>
            <Link href="/" className="reset-password-link">
              Back to home
            </Link>
            <p className="reset-password-hint">
              You can request a new link from the Log in form (&quot;Forgot password?&quot;).
            </p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="reset-password-wrapper">
      <Navbar />
      <Subnavbar />
      <main className="reset-password-main">
        <div className="reset-password-card">
          <h1 className="reset-password-title">Set new password</h1>
          <p className="reset-password-text">
            Enter your new password below. Use at least {MIN_PASSWORD_LENGTH} characters.
          </p>
          <form onSubmit={handleSubmit} className="reset-password-form">
            {error && (
              <div className="reset-password-error" role="alert">
                {error}
              </div>
            )}
            <div className="reset-password-field">
              <label htmlFor="reset-password" className="reset-password-label">
                New password
              </label>
              <div className="reset-password-input-wrap">
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="reset-password-input"
                  placeholder="New password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="reset-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="reset-password-field">
              <label htmlFor="reset-password-confirm" className="reset-password-label">
                Confirm password
              </label>
              <input
                id="reset-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="reset-password-input"
                placeholder="Confirm new password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="reset-password-submit" disabled={submitLoading}>
              {submitLoading ? 'Updating…' : 'Update password'}
            </button>
          </form>
          <p className="reset-password-hint">
            After updating, you will be logged in and redirected to your profile.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div>
        <Navbar />
        <Subnavbar />
        <main style={{ padding: '2rem', textAlign: 'center' }}><p>Loading…</p></main>
        <Footer />
      </div>
    }>
      <ResetPasswordInner />
    </Suspense>
  )
}
