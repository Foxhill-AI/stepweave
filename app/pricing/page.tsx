'use client'

import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import Pricing from '@/components/Pricing'
import '@/styles/pricing.css'

export default function PricingPage() {
  return (
    <div className="pricing-page-wrapper">
      <Navbar />
      
      <Subnavbar />
      
      <Pricing />
      
      <Footer />
    </div>
  )
}