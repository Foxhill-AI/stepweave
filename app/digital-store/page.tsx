'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import DigitalStore from '@/components/DigitalStore'

function DigitalStoreInner() {
  const searchParams = useSearchParams()
  const categorySlug = searchParams.get('category')

  return (
    <div className="digital-store-page-wrapper">
      <Navbar />
      <Subnavbar />
      <DigitalStore categorySlug={categorySlug} />
      <Footer />
    </div>
  )
}

export default function DigitalStorePage() {
  return (
    <Suspense fallback={<div className="digital-store-page-wrapper"><Navbar /><Subnavbar /><Footer /></div>}>
      <DigitalStoreInner />
    </Suspense>
  )
}
