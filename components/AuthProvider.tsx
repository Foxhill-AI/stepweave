'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

function getRecoveryPending(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some((c) => c.trim().startsWith('recovery_pending='))
}

type UserAccountRow = {
  id: number
  auth_user_id: string
  username: string
  avatar_url: string | null
  bio: string | null
  role: string
  subscription_tier: string
  created_at: string
  updated_at: string | null
  /** Stripe Connect Express (creator payouts); optional until migration applied */
  stripe_connect_account_id?: string | null
  stripe_connect_charges_enabled?: boolean
  stripe_connect_payouts_enabled?: boolean
  stripe_connect_details_submitted?: boolean
  stripe_connect_onboarding_completed_at?: string | null
  stripe_connect_last_synced_at?: string | null
}

type AuthContextType = {
  user: User | null
  userAccount: UserAccountRow | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUserAccount: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [userAccount, setUserAccount] = useState<UserAccountRow | null>(null)
  const [loading, setLoading] = useState(true)
  const loadedForUserId = useRef<string | null>(null)
  const safetyNetRetries = useRef(0)

  const fetchUserAccount = async (authUserId: string, _userEmail?: string | null) => {
    const dev = process.env.NODE_ENV === 'development'

    // Use the server-side API route which uses the service role key.
    // This bypasses RLS and any client-side JWT timing issues that occur
    // right after OAuth (exchangeCodeForSession sets the cookie, server reads it).
    const tryFetch = async (): Promise<UserAccountRow | null> => {
      try {
        const res = await fetch('/api/me/account', { credentials: 'include' })
        if (!res.ok) {
          if (dev) console.log('[AuthProvider] /api/me/account status:', res.status)
          return null
        }
        const body = (await res.json()) as { userAccount: UserAccountRow | null }
        return body.userAccount ?? null
      } catch {
        return null
      }
    }

    let data = await tryFetch()
    if (dev) console.log('[AuthProvider] fetchUserAccount attempt 0:', { found: !!data })

    // Retry if the row isn't there yet (DB trigger may still be committing).
    if (!data) {
      const delays = [300, 600, 1200, 2400, 4000]
      for (let i = 0; i < delays.length; i++) {
        await new Promise((r) => setTimeout(r, delays[i]))
        data = await tryFetch()
        if (dev) console.log(`[AuthProvider] fetchUserAccount attempt ${i + 1}:`, { found: !!data })
        if (data) break
      }
    }

    setUserAccount(data)
    loadedForUserId.current = authUserId

    if (dev && !data) {
      console.warn('[AuthProvider] fetchUserAccount: no user_account row found after all retries for', authUserId)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (hash && hash.includes('type=recovery')) {
      document.cookie = 'recovery_pending=1; path=/; max-age=900'
      router.replace('/auth/reset-password' + hash)
    }
  }, [router])

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return

      if (session?.user && !getRecoveryPending()) {
        setUser(session.user)
        await fetchUserAccount(session.user.id, session.user.email)
      } else {
        setUser(null)
        setUserAccount(null)
        loadedForUserId.current = null
      }
      if (mounted) setLoading(false)
    }

    initialize()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (process.env.NODE_ENV === 'development') {
        console.log('[AuthProvider] onAuthStateChange', event, session?.user?.email ?? 'no session')
      }

      if (event === 'INITIAL_SESSION') {
        if (session?.user && loadedForUserId.current === session.user.id) return
        if (session?.user && !getRecoveryPending()) {
          setUser(session.user)
          await fetchUserAccount(session.user.id, session.user.email)
          if (mounted) setLoading(false)
        }
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user && !getRecoveryPending()) {
          if (loadedForUserId.current !== session.user.id) {
            // Keep loading=true while we fetch the user account so no page
            // renders with user≠null but userAccount=null (blank profile).
            if (mounted) setLoading(true)
            setUser(session.user)
            await fetchUserAccount(session.user.id, session.user.email)
            if (mounted && typeof window !== 'undefined') {
              // Yield one tick so React commits setUserAccount before navigating.
              setTimeout(() => window.dispatchEvent(new CustomEvent('auth-ready')), 0)
            }
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setUserAccount(null)
        loadedForUserId.current = null
      } else if (event === 'USER_UPDATED') {
        if (session?.user) {
          setUser(session.user)
          loadedForUserId.current = null
          await fetchUserAccount(session.user.id, session.user.email)
        }
      }

      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Safety net: if user is authenticated but userAccount is still null after loading
  // completes, re-fetch. This catches the race where initialize() finds the session
  // but fetchUserAccount returns null (trigger not committed yet), and the SIGNED_IN
  // guard then skips re-fetching because loadedForUserId was already set.
  useEffect(() => {
    if (loading || !user || userAccount) {
      if (userAccount) safetyNetRetries.current = 0  // reset counter on success
      return
    }
    if (safetyNetRetries.current >= 3) return  // give up after 3 attempts
    safetyNetRetries.current += 1
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[AuthProvider] user set but userAccount null — safety-net re-fetch #${safetyNetRetries.current}`)
    }
    loadedForUserId.current = null
    void fetchUserAccount(user.id, user.email)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, userAccount])

  useEffect(() => {
    if (pathname === '/auth/reset-password' || loading) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && getRecoveryPending()) {
        router.replace('/auth/reset-password')
      }
    })
  }, [pathname, loading, router])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserAccount(null)
    loadedForUserId.current = null
    safetyNetRetries.current = 0
  }

  const refreshUserAccount = async () => {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (u?.id) {
      loadedForUserId.current = null
      await fetchUserAccount(u.id, u.email)
    }
  }

  return (
    <AuthContext.Provider value={{ user, userAccount, loading, signOut, refreshUserAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
