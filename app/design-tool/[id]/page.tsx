'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import DesignToolPage from '@/components/design-tool/DesignToolPage'
import { useAuth } from '@/components/AuthProvider'
import { getDesignDraftById } from '@/lib/supabaseClient'
import type { DesignDraftRow } from '@/lib/supabaseClient'

export default function DesignToolDraftRoute() {
  const router = useRouter()
  const params = useParams()
  const { user, loading: authLoading } = useAuth()
  const draftIdParam = typeof params.id === 'string' ? params.id : undefined
  const [draft, setDraft] = useState<DesignDraftRow | null>(null)
  const [draftLoading, setDraftLoading] = useState(!!draftIdParam)
  const [draftError, setDraftError] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/')
      return
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!draftIdParam) return
    const id = Number(draftIdParam)
    if (Number.isNaN(id)) {
      setDraftError(true)
      setDraftLoading(false)
      return
    }
    let cancelled = false
    getDesignDraftById(id)
      .then((d) => {
        if (cancelled) return
        if (d) {
          setDraft(d)
          setDraftError(false)
        } else {
          setDraft(null)
          setDraftError(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDraft(null)
          setDraftError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setDraftLoading(false)
      })
    return () => { cancelled = true }
  }, [draftIdParam])

  if (authLoading || draftLoading) {
    return (
      <div className="design-tool-page-wrapper">
        <Navbar />
        <main className="design-tool-main" role="main">
          <p className="design-tool-loading" aria-live="polite">Loading…</p>
        </main>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!draftIdParam || draftError || !draft) {
    return (
      <div className="design-tool-page-wrapper">
        <Navbar />
        <Subnavbar />
        <main className="design-tool-main" role="main">
          <p className="design-tool-loading">Draft not found. <a href="/design-tool">Start a new design</a>.</p>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="design-tool-page-wrapper">
      <Navbar />
      <Subnavbar />
      <main className="design-tool-main" role="main">
        <DesignToolPage draftId={draft.id} draft={draft} />
      </main>
      <Footer />
    </div>
  )
}
