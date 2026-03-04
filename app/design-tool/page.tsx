'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import DesignToolPage from '@/components/design-tool/DesignToolPage'
import { useAuth } from '@/components/AuthProvider'

export default function DesignToolRoute() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/')
      return
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="design-tool-page-wrapper">
        <Navbar />
        <main className="design-tool-main" role="main">
          <p aria-live="polite">Loading…</p>
        </main>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="design-tool-page-wrapper">
      <Navbar />
      <Subnavbar />
      <main className="design-tool-main" role="main">
        <DesignToolPage />
      </main>
      <Footer />
    </div>
  )
}
