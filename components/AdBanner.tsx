'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getActiveAdvertisements } from '@/lib/supabaseClient'
import type { AdvertisementRow } from '@/lib/supabaseClient'
import '../styles/AdBanner.css'

export default function AdBanner() {
  const [ads, setAds] = useState<AdvertisementRow[]>([])
  const [loading, setLoading] = useState(true)



  useEffect(() => {
    let cancelled = false
    getActiveAdvertisements()
      .then((rows) => {
        if (!cancelled) setAds(rows)
      })
      .catch(() => {
        if (!cancelled) setAds([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading || ads.length === 0) return null

  return (
    <section className="ad-banner-section" aria-label="Promotions">
      <div className="ad-banner-container">
        {ads.slice(0, 3).map((ad) => (
          <div key={ad.id} className="ad-banner-item">
            {ad.link_url ? (
              <Link href={ad.link_url} className="ad-banner-link" target="_blank" rel="noopener noreferrer">
                <img src={ad.image_url} alt={ad.title} className="ad-banner-image" />
                {ad.title && <span className="ad-banner-title">{ad.title}</span>}
              </Link>
            ) : (
              <div className="ad-banner-placeholder">
                <img src={ad.image_url} alt={ad.title} className="ad-banner-image" />
                {ad.title && <span className="ad-banner-title">{ad.title}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}




// This is for throwing deployment