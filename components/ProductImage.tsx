'use client'

import { useState, useEffect } from 'react'

export type ProductDesignData = { imageUrl?: string; source?: string } | null

interface ProductImageProps {
  productId: number
  designData: ProductDesignData | null
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
  /** Optional fallback content when no image (e.g. first letter of title). */
  fallback?: React.ReactNode
}

/**
 * Renders product image.
 * 1. When `productId` is set: load Printful mockup from `/api/products/[id]/mockup-image` (actual product photo).
 * 2. If no mockup: for `design_data.source === 'design_draft'` show fallback only (never the flat pattern on cards).
 * 3. For other products, use `design_data.imageUrl` as static URL.
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

  const useDesignDraftApi =
    Boolean(designData && (designData as { source?: string }).source === 'design_draft')
  const staticUrl = designData?.imageUrl ?? null

  useEffect(() => {
    setLoadFailed(false)
    let cancelled = false

    const applyStatic = () => {
      if (!cancelled) setResolvedUrl(staticUrl)
    }

    if (!productId) {
      setResolvedUrl(staticUrl)
      return
    }

    if (!useDesignDraftApi && staticUrl) {
      setResolvedUrl(staticUrl)
    } else {
      setResolvedUrl(null)
    }

    fetch(`/api/products/${productId}/mockup-image`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body: { url?: string | null }) => {
        if (cancelled) return
        if (body.url) {
          setResolvedUrl(body.url)
          return
        }
        if (useDesignDraftApi) {
          setResolvedUrl(null)
          return
        }
        applyStatic()
      })
      .catch(() => {
        if (cancelled) return
        if (useDesignDraftApi) {
          setResolvedUrl(null)
          return
        }
        applyStatic()
      })

    return () => {
      cancelled = true
    }
  }, [productId, useDesignDraftApi, staticUrl])

  const handleImgError = () => {
    setLoadFailed(true)
    setResolvedUrl(null)
  }

  const src = productId ? resolvedUrl : staticUrl
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
