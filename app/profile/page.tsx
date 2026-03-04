'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import ProfilePage from '@/components/ProfilePage'
import { useAuth } from '@/components/AuthProvider'
import { getProfileStats } from '@/lib/supabaseClient'

export default function Profile() {
  const router = useRouter()
  const { user, userAccount, loading } = useAuth()
  const [profileStats, setProfileStats] = useState<{
    followers: number
    following: number
    products: number
    likesReceived: number
  } | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) router.replace('/')
  }, [user, loading, router])

  useEffect(() => {
    if (!userAccount?.id) {
      setProfileStats(null)
      return
    }
    let cancelled = false
    getProfileStats(userAccount.id)
      .then((stats) => {
        if (!cancelled) setProfileStats(stats)
      })
      .catch(() => {
        if (!cancelled) setProfileStats(null)
      })
    return () => { cancelled = true }
  }, [userAccount?.id])

  if (loading) {
    return (
      <div className="profile-page-wrapper">
        <Navbar />
        <main className="profile-main" role="main" style={{ padding: '2rem', textAlign: 'center' }}>
          Loading…
        </main>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="profile-page-wrapper">
      <Navbar />
      
      <Subnavbar />
      
      <main className="profile-main" role="main">
        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading profile…</div>}>
          <ProfilePage
            userData={{
              username: (userAccount?.username?.trim() || user?.email?.split('@')[0]) ?? '',
              avatar: userAccount?.avatar_url ?? undefined,
              bio: userAccount?.bio ?? undefined,
              joinedDate: userAccount?.created_at,
              followers: profileStats?.followers ?? 0,
              following: profileStats?.following ?? 0,
              products: profileStats?.products ?? 0,
              likes: profileStats?.likesReceived ?? 0,
            }}
          />
        </Suspense>
      </main>
      
      <Footer />
    </div>
  )
}
