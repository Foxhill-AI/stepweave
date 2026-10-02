'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import Pricing from '@/components/Pricing'
import '@/styles/pricing.css'

export default function PricingPage() {
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('subscription') === 'success') {
      const returnPath = params.get('return')
      if (returnPath && returnPath.startsWith('/') && !returnPath.includes('://')) {
        router.replace(returnPath)
      }
    }
  }, [router])

  return (
    <div className="pricing-page-wrapper">
      <Navbar />
      
      <Subnavbar />
      
      <Pricing />
      
      <Footer />
    </div>
  )
}