'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Modal from './ui/Modal'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import '../styles/SignUpModal.css'

type AuthView = 'login' | 'signup' | 'forgotPassword'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  /** When set, open directly in this view (e.g. from a "Sign up" link elsewhere). */
  initialView?: AuthView
}

export default function AuthModal({
  isOpen,
  onClose,
  initialView = 'login',
}: AuthModalProps) {
  const [view, setView] = useState<AuthView>(initialView)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** After sign up when email confirmation is required: show "Check your email" instead of closing. */
  const [verifyEmailSent, setVerifyEmailSent] = useState(false)
  const [verifyEmailTo, setVerifyEmailTo] = useState('')
  /** After forgot password submit: show generic "check your email" message (security). */
  const [resetEmailSent, setResetEmailSent] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setView(initialView)
      setError(null)
      setVerifyEmailSent(false)
      setVerifyEmailTo('')
      setResetEmailSent(false)
    }
  }, [isOpen, initialView])

  const resetForm = () => {
    setEmail('')
    setUsername('')
    setPassword('')
    setShowPassword(false)
    setError(null)
    setVerifyEmailSent(false)
    setVerifyEmailTo('')
    setResetEmailSent(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const switchToSignUp = () => {
    setError(null)
    setView('signup')
  }

  const switchToLogin = () => {
    setError(null)
    setView('login')
  }

  const switchToForgotPassword = () => {
    setError(null)
    setResetEmailSent(false)
    setView('forgotPassword')
  }

  const handleResendVerification = async () => {
    if (!supabase || !email.trim()) return
    setError(null)
    setIsLoading(true)
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      })
      if (resendError) {
        setError(resendError.message)
        return
      }
      setError(null)
      setVerifyEmailSent(true)
      setVerifyEmailTo(email.trim())
      setView('signup')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialAuth = async (provider: 'google' | 'facebook') => {
    if (!isSupabaseConfigured) {
      setError('Supabase URL is not configured. Set NEXT_PUBLIC_SUPABASE_URL in your host (e.g. Vercel) and redeploy.')
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')}/auth/callback`
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      })
      if (oauthError) {
        setError(oauthError.message)
        return
      }
      const url = data?.url
      if (url?.startsWith('http') && url.includes('supabase.co')) {
        window.location.href = url
        return
      }
      if (url && !url.includes('supabase.co')) {
        setError('Login misconfigured: Supabase URL missing. Set NEXT_PUBLIC_SUPABASE_URL and redeploy.')
        return
      }
      handleClose()
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: 'same-origin',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? (res.status === 401 ? 'Invalid email or password.' : 'Sign in failed.'))
        return
      }
      handleClose()
      if (typeof window !== 'undefined') window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    if (!supabase) {
      setError('Supabase is not configured. Check your environment variables.')
      setIsLoading(false)
      return
    }
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: redirectTo },
      })
      if (signUpError) {
        const msg = signUpError.message
        if (
          msg.toLowerCase().includes('email') &&
          (msg.toLowerCase().includes('confirm') || msg.toLowerCase().includes('500') || msg.toLowerCase().includes('sending'))
        ) {
          setError(
            'Verification email could not be sent. In Supabase: disable "Confirm email" (Auth → Providers → Email) to allow sign up, or fix SMTP (Project Settings → Auth). See docs/SUPABASE_AUTH_EMAIL.md.'
          )
        } else {
          setError(signUpError.message)
        }
        return
      }
      if (authData?.user) {
        const { error: insertError } = await supabase.from('user_account').insert({
          auth_user_id: authData.user.id,
          username: username.trim() || email.split('@')[0],
        })
        if (insertError) {
          setError(insertError.message)
          return
        }
        if (!authData.session) {
          setVerifyEmailSent(true)
          setVerifyEmailTo(email.trim())
          return
        }
      }
      handleClose()
    } finally {
      setIsLoading(false)
    }
  }

  const getRedirectUrl = () =>
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`

  const getResetPasswordRedirectUrl = () =>
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/reset-password`
      : `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password`

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!supabase || !email.trim()) return
    setIsLoading(true)
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getResetPasswordRedirectUrl(),
      })
      setResetEmailSent(true)
    } catch {
      // Always show same message for security (don't reveal if email exists)
      setResetEmailSent(true)
    } finally {
      setIsLoading(false)
    }
  }

  const isLogin = view === 'login'
  const isForgotPassword = view === 'forgotPassword'
  const title = verifyEmailSent
    ? 'Check your email'
    : resetEmailSent
      ? 'Check your email'
      : isForgotPassword
        ? 'Forgot password'
        : isLogin
          ? 'Log in'
          : 'Sign up'

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <div className="signup-modal">
        {verifyEmailSent ? (
          <div className="signup-verify-email" data-testid="verify-email-sent">
            <p className="signup-verify-text">
              We sent a verification link to <strong>{verifyEmailTo}</strong>.
            </p>
            <p className="signup-verify-subtext">
              Click the link in that email to verify your account. You can close this window.
            </p>
            <button type="button" className="submit-button" onClick={handleClose}>
              Close
            </button>
          </div>
        ) : resetEmailSent ? (
          <div className="signup-verify-email" data-testid="reset-email-sent">
            <p className="signup-verify-text">Check your email</p>
            <p className="signup-verify-subtext">
              If an account exists for that email address, you will receive a link to reset your password. Check your inbox and spam folder.
            </p>
            <button type="button" className="submit-button" onClick={handleClose}>
              Close
            </button>
            <button type="button" className="signup-resend-link" onClick={() => { setResetEmailSent(false) }}>
              Try another email
            </button>
          </div>
        ) : isForgotPassword ? (
          <>
            <form onSubmit={handleForgotPasswordSubmit} className="signup-form">
              <div className="form-group">
                <label htmlFor="forgot-email" className="form-label">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  placeholder="Enter your email"
                  required
                  autoComplete="email"
                />
              </div>
              <button type="submit" className="submit-button" disabled={isLoading}>
                {isLoading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <div className="switch-auth">
              <button type="button" className="switch-button" onClick={switchToLogin}>
                Back to Log in
              </button>
            </div>
          </>
        ) : (
        <>
        <div className="social-buttons">
          <button
            type="button"
            className="social-button social-button-google"
            onClick={() => handleSocialAuth('google')}
            disabled={isLoading}
          >
            <svg
              className="social-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span>{isLogin ? 'Continue with Google' : 'Sign up with Google'}</span>
          </button>
          <button
            type="button"
            className="social-button social-button-facebook"
            onClick={() => handleSocialAuth('facebook')}
            disabled={isLoading}
          >
            <svg
              className="social-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span>{isLogin ? 'Continue with Facebook' : 'Sign up with Facebook'}</span>
          </button>
        </div>

        <div className="divider">
          <span>or</span>
        </div>

        {isLogin ? (
          <form onSubmit={handleLoginSubmit} className="signup-form">
            {error && (
              <div className="signup-error" role="alert">
                {error}
              </div>
            )}
            <div className="form-group">
              <label htmlFor="auth-email" className="form-label">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="Enter your email"
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="auth-password" className="form-label">
                  Password
                </label>
              </div>
              <div className="password-input-wrapper">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="submit-button"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Log in'}
            </button>
            {error && error.includes('verify your email') && (
              <button
                type="button"
                className="signup-resend-link"
                onClick={handleResendVerification}
                disabled={isLoading || !email.trim()}
              >
                Resend verification email
              </button>
            )}
            <div className="forgot-password-row">
              <button
                type="button"
                className="signup-resend-link"
                onClick={switchToForgotPassword}
              >
                Forgot password?
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignUpSubmit} className="signup-form">
            {error && (
              <div className="signup-error" role="alert">
                {error}
              </div>
            )}
            <div className="form-group">
              <label htmlFor="signup-email" className="form-label">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="Enter your email"
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label htmlFor="signup-username" className="form-label">
                Username
              </label>
              <input
                id="signup-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-input"
                placeholder="Choose a username"
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="signup-password" className="form-label">
                  Password
                </label>
              </div>
              <div className="password-input-wrapper">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  placeholder="Enter your password"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="submit-button"
              disabled={isLoading}
            >
              {isLoading ? 'Signing up...' : 'Sign up'}
            </button>
          </form>
        )}

        {!isLogin && (
          <div className="terms-text">
            <p>
              By signing up you agree to Template&apos;s{' '}
              <a href="/terms" className="terms-link">
                Terms and Conditions
              </a>{' '}
              and{' '}
              <a href="/privacy" className="terms-link">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        )}

        <div className="switch-auth">
          <p className="switch-auth-text">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
          </p>
          <button
            type="button"
            className="switch-button"
            onClick={isLogin ? switchToSignUp : switchToLogin}
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </div>
        </>
        )}
      </div>
    </Modal>
  )
}
