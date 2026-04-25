'use client'

import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import Marketplace from '@/components/Marketplace'
import '@/styles/MyCollection.css'
import '../homepage.css'

function MarketplaceInner() {
  return (
    <div className="collection-page-wrapper">
      <Navbar />
      <Subnavbar />
      <main className="collection-main" role="main">
        <div className="my-collection">
          <div className="collection-container">
            <div className="container">
              <Marketplace />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <div className="collection-page-wrapper">
          <Navbar />
          <Subnavbar />
          <main className="collection-main" role="main">
            <div className="my-collection">
              <div className="collection-container">
                <div className="container">
                  <p className="homepage-loading" aria-live="polite">
                    Loading…
                  </p>
                </div>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      }
    >
      <MarketplaceInner />
    </Suspense>
  )
}
