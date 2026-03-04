'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import Marketplace from '@/components/Marketplace'

function MarketplaceInner() {
  const searchParams = useSearchParams()
  const categorySlug = searchParams.get('category')

  return (
    <div className="marketplace-page-wrapper">
      <Navbar />
      <Subnavbar />
      <Marketplace categorySlug={categorySlug} />
      <Footer />
    </div>
  )
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="marketplace-page-wrapper"><Navbar /><Subnavbar /><Footer /></div>}>
      <MarketplaceInner />
    </Suspense>
  )
}
