'use client'

import { useState, useEffect, useRef } from 'react'

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

function fetchDesignImageUrl(productId: number): Promise<string | null> {
  return fetch(`/api/products/${productId}/design-image`)
    .then((res) => (res.ok ? res.json() : Promise.reject()))
    .then((b: { url?: string }) => (typeof b.url === 'string' && b.url ? b.url : null))
    .catch(() => null)
}

/**
 * Renders product image. When design_data.source === 'design_draft':
 * 1. Tries /api/products/[id]/mockup-image (Printful mockup — best visual quality).
 * 2. Falls back to /api/products/[id]/design-image (raw pattern from Storage).
 * 3. If the mockup URL loads but fails in the browser (expired/blocked), onError loads design-image.
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
  const [loadFailed, setLoadFailed] = useState(false)
  const triedDesignAfterBadMockup = useRef(false)

  const useDesignDraftApi =
    designData && (designData as { source?: string }).source === 'design_draft'
  const staticUrl = designData?.imageUrl ?? null

  useEffect(() => {
    triedDesignAfterBadMockup.current = false
    setLoadFailed(false)
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
          return fetchDesignImageUrl(productId).then((url) => {
            if (!cancelled && url) setResolvedUrl(url)
          })
        }
      })
      .catch(() => {
        // Mockup failed — try design image
        if (cancelled) return
        fetchDesignImageUrl(productId).then((url) => {
          if (!cancelled && url) setResolvedUrl(url)
        })
      })

    return () => {
      cancelled = true
    }
  }, [productId, useDesignDraftApi, staticUrl])

  const handleImgError = () => {
    if (!useDesignDraftApi) {
      setLoadFailed(true)
      setResolvedUrl(null)
      return
    }
    if (!triedDesignAfterBadMockup.current) {
      triedDesignAfterBadMockup.current = true
      setResolvedUrl(null)
      void fetchDesignImageUrl(productId).then((url) => {
        if (url) {
          setLoadFailed(false)
          setResolvedUrl(url)
        } else {
          setLoadFailed(true)
          setResolvedUrl(null)
        }
      })
      return
    }
    setLoadFailed(true)
    setResolvedUrl(null)
  }

  const src = useDesignDraftApi ? resolvedUrl : staticUrl
  if (src && !loadFailed) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        onError={handleImgError}
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
