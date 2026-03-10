'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Modal from './ui/Modal'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import '../styles/SignUpModal.css'

interface SignUpModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToLogin?: () => void
}

export default function SignUpModal({
  isOpen,
  onClose,
  onSwitchToLogin,
}: SignUpModalProps) {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    if (!supabase) {
      setError('Supabase is not configured. Check your environment variables.')
      setIsLoading(false)
      return
    }
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      if (signUpError) {
        setError(signUpError.message)
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
      }
      onClose()
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    if (!isSupabaseConfigured) {
      setError('Supabase URL is not configured. Set NEXT_PUBLIC_SUPABASE_URL in your host (e.g. Vercel) and redeploy.')
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      const redirectTo = `${typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')}/auth/callback`
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
      onClose()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sign up">
      <div className="signup-modal">
        {/* Social Login Buttons */}
        <div className="social-buttons">
          <button
            type="button"
            className="social-button social-button-google"
            onClick={() => handleSocialLogin('google')}
          >
            <svg
              className="social-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24  "
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
            <span>Sign up with Google</span>
          </button>

          <button
            type="button"
            className="social-button social-button-facebook"
            onClick={() => handleSocialLogin('facebook')}
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
            <span>Sign up with Facebook</span>
          </button>

          {/* <button
            type="button"
            className="social-button social-button-apple"
            onClick={() => handleSocialLogin('apple')}
          >
            <svg
              className="social-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            <span>Sign up with Apple</span>
          </button> */}
        </div>

        {/* Divider */}
        <div className="divider">
          <span>or</span>
        </div>

        {/* Email / Username / Password Form */}
        <form onSubmit={handleSubmit} className="signup-form">
          {error && (
            <div className="signup-error" role="alert">
              {error}
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              id="email"
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
            <label htmlFor="username" className="form-label">
              Username
            </label>
            <input
              id="username"
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
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <button
                type="button"
                className="form-link"
                onClick={() => {
                  /* Handle password reset */
                }}
              >
                Reset Password
              </button>
            </div>
            <div className="password-input-wrapper">
              <input
                id="password"
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

        {/* Terms and Privacy */}
        <div className="terms-text">
          <p>
            Click "Sign up" to agree to Template's{' '}
            <a href="/terms" className="terms-link">
              Terms and Conditions
            </a>{' '}
            and acknowledge that Template's{' '}
            <a href="/privacy" className="terms-link">
              Privacy Policy
            </a>{' '}
            applies to you.
          </p>
          <p>
            This site is protected by reCAPTCHA and the Google{' '}
            <a
              href="https://policies.google.com/privacy"
              className="terms-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>{' '}
            and{' '}
            <a
              href="https://policies.google.com/terms"
              className="terms-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of Service
            </a>{' '}
            apply.
          </p>
        </div>

        {/* Switch to Login */}
        {onSwitchToLogin && (
          <div className="switch-auth">
            <button
              type="button"
              className="switch-button"
              onClick={onSwitchToLogin}
            >
              Log in
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}