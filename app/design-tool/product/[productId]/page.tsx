'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import DesignToolPage from '@/components/design-tool/DesignToolPage'
import { useAuth } from '@/components/AuthProvider'
import { getDesignDraftByFinalProductId } from '@/lib/supabaseClient'
import type { DesignDraftRow } from '@/lib/supabaseClient'

/**
 * Edit an existing product in the full design tool.
 * Resolves the linked design_draft via final_product_id (set when the product was created from a draft).
 */
export default function DesignToolEditProductRoute() {
  const router = useRouter()
  const params = useParams()
  const { user, loading: authLoading } = useAuth()
  const rawId = typeof params.productId === 'string' ? params.productId : undefined
  const [draft, setDraft] = useState<DesignDraftRow | null>(null)
  const [loading, setLoading] = useState(!!rawId)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/')
      return
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!rawId) return
    const productId = Number(rawId)
    if (Number.isNaN(productId)) {
      setNotFound(true)
      setLoading(false)
      return
    }
    let cancelled = false
    getDesignDraftByFinalProductId(productId)
      .then((d) => {
        if (cancelled) return
        if (d) {
          setDraft(d)
          setNotFound(false)
        } else {
          setDraft(null)
          setNotFound(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDraft(null)
          setNotFound(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [rawId])

  if (authLoading || loading) {
    return (
      <div className="design-tool-page-wrapper">
        <Navbar />
        <main className="design-tool-main" role="main">
          <p className="design-tool-loading" aria-live="polite">
            Loading design…
          </p>
        </main>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!rawId || notFound || !draft) {
    return (
      <div className="design-tool-page-wrapper">
        <Navbar />
        <Subnavbar />
        <main className="design-tool-main" role="main">
          <p className="design-tool-loading">
            No design draft is linked to this product. Products created outside the design tool cannot be
            opened here.{' '}
            <a href="/profile">Back to My Products</a>
            {' · '}
            <a href="/design-tool">Start a new design</a>.
          </p>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="design-tool-page-wrapper design-tool-page-wrapper--editor">
      <Navbar />
      <Subnavbar />
      <main className="design-tool-main" role="main">
        <DesignToolPage draftId={draft.id} draft={draft} />
      </main>
    </div>
  )
}
