'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import NotificationsPage from '@/components/NotificationsPage'
import { useAuth } from '@/components/AuthProvider'
import '@/styles/NotificationsPage.css'

export default function NotificationsPageWrapper() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) router.replace('/')
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="notifications-page-wrapper">
        <Navbar />
        <main style={{ padding: '2rem', textAlign: 'center' }}>Loading…</main>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="notifications-page-wrapper">
      <Navbar />
      
      <Subnavbar />
      
      <NotificationsPage />
      
      <Footer />
    </div>
  )
}
