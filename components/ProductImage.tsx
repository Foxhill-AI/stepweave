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
 * Renders product image. When design_data.source === 'design_draft', fetches
 * signed URL from /api/products/[id]/design-image; otherwise uses design_data.imageUrl.
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
  const [failed, setFailed] = useState(false)

  const useDesignDraftApi =
    designData && (designData as { source?: string }).source === 'design_draft'
  const staticUrl = designData?.imageUrl ?? null

  useEffect(() => {
    if (!useDesignDraftApi) {
      setResolvedUrl(staticUrl)
      setFailed(false)
      return
    }
    setResolvedUrl(null)
    setFailed(false)
    let cancelled = false
    fetch(`/api/products/${productId}/design-image`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Not found'))))
      .then((body: { url?: string }) => {
        if (!cancelled && body.url) setResolvedUrl(body.url)
        else if (!cancelled) setFailed(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
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
