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

  const fetchUserAccount = async (authUserId: string, userEmail?: string | null) => {
    const { data } = await supabase
      .from('user_account')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle()
    if (data) {
      setUserAccount(data)
      loadedForUserId.current = authUserId
      return
    }
    const defaultUsername =
      userEmail && userEmail.includes('@')
        ? userEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 50) || 'user'
        : 'user'
    const { error } = await supabase
      .from('user_account')
      .insert({ auth_user_id: authUserId, username: defaultUsername })
    if (!error) {
      const { data: inserted } = await supabase
        .from('user_account')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle()
      setUserAccount(inserted ?? null)
      loadedForUserId.current = authUserId
      return
    }
    const { data: retry } = await supabase
      .from('user_account')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle()
    setUserAccount(retry ?? null)
    loadedForUserId.current = authUserId
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
            setUser(session.user)
            await fetchUserAccount(session.user.id, session.user.email)
            if (mounted && typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('auth-ready'))
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
