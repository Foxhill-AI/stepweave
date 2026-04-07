'use client'

import { useState, useEffect } from 'react'

export type ProductDesignData = { imageUrl?: string; source?: string } | null

interface ProductImageProps {
  productId: number
  designData: ProductDesignData
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
  /** Optional fallback content when no image (e.g. first letter of title). */
  fallback?: React.ReactNode
}

/**
 * Renders product image. When design_data.source === 'design_draft':
 * 1. Tries /api/products/[id]/mockup-image (Printful mockup — best visual quality).
 * 2. Falls back to /api/products/[id]/design-image (raw pattern from Storage).
 * Otherwise uses design_data.imageUrl as a static URL.
 */
export default function ProductImage({
  productId,
  designData,
  alt,
  className,
  loading = 'lazy',
  fallback,
}: ProductImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)

  const useDesignDraftApi =
    designData && (designData as { source?: string }).source === 'design_draft'
  const staticUrl = designData?.imageUrl ?? null

  useEffect(() => {
    if (!useDesignDraftApi) {
      setResolvedUrl(staticUrl)
      return
    }
    setResolvedUrl(null)
    let cancelled = false

    // Try mockup image first; fall back to raw design image
    fetch(`/api/products/${productId}/mockup-image`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body: { url?: string | null }) => {
        if (cancelled) return
        if (body.url) {
          setResolvedUrl(body.url)
        } else {
          // No mockup yet — fall back to pattern image from Storage
          return fetch(`/api/products/${productId}/design-image`)
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((b: { url?: string }) => {
              if (!cancelled && b.url) setResolvedUrl(b.url)
            })
        }
      })
      .catch(() => {
        // Mockup failed — try design image
        if (cancelled) return
        fetch(`/api/products/${productId}/design-image`)
          .then((res) => (res.ok ? res.json() : Promise.reject()))
          .then((b: { url?: string }) => {
            if (!cancelled && b.url) setResolvedUrl(b.url)
          })
          .catch(() => {})
      })

    return () => {
      cancelled = true
    }
  }, [productId, useDesignDraftApi, staticUrl])

  const src = useDesignDraftApi ? resolvedUrl : staticUrl
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
      />
    )
  }
  if (fallback !== undefined) {
    return <>{fallback}</>
  }
  return (
    <div style={{ background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
      <span style={{ color: '#999', fontSize: '0.875rem' }}>{alt.charAt(0).toUpperCase()}</span>
    </div>
  )
}
