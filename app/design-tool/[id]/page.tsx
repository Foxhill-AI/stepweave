'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import EditProductPage from '@/components/design-tool/EditProductPage'
import { useAuth } from '@/components/AuthProvider'

export default function DesignToolEditRoute() {
  const router = useRouter()
  const params = useParams()
  const { user, loading } = useAuth()
  const productId = typeof params.id === 'string' ? params.id : undefined

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

  if (!productId) {
    return (
      <div className="design-tool-page-wrapper">
        <Navbar />
        <Subnavbar />
        <main className="design-tool-main" role="main">
          <p>Invalid product.</p>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="design-tool-page-wrapper">
      <Navbar />
      <Subnavbar />
      <main className="design-tool-main" role="main">
        <EditProductPage productId={productId} />
      </main>
      <Footer />
    </div>
  )
}
