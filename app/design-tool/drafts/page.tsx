'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import '../../../styles/DesignTool.css'
import { useAuth } from '@/components/AuthProvider'
import {
  getCurrentUserAccount,
  getDesignDraftsByUser,
  type DesignDraftRow,
} from '@/lib/supabaseClient'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function DraftCard({ draft }: { draft: DesignDraftRow }) {
  const router = useRouter()
  const mockups = Array.isArray(draft.mockup_urls)
    ? (draft.mockup_urls as Array<{ mockup_url?: string }>)
    : []
  const thumbUrl = mockups.find((m) => m.mockup_url?.trim())?.mockup_url ?? null

  return (
    <button
      type="button"
      className="dt-draft-card"
      onClick={() => router.push(`/design-tool/${draft.id}`)}
    >
      <div className="dt-draft-card-thumb">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="" className="dt-draft-card-thumb-img" />
        ) : (
          <div className="dt-draft-card-thumb-placeholder" aria-hidden />
        )}
      </div>
      <div className="dt-draft-card-info">
        <span className="dt-draft-card-name">
          {draft.name ?? `Design #${draft.id}`}
        </span>
        <span className="dt-draft-card-meta">
          Updated {formatDate(draft.updated_at)}
        </span>
      </div>
    </button>
  )
}

export default function DesignToolDraftsRoute() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [drafts, setDrafts] = useState<DesignDraftRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/design-tool')
      return
    }
    let cancelled = false
    getCurrentUserAccount().then((account) => {
      if (cancelled || !account) return
      getDesignDraftsByUser(account.id, { status: 'draft' }).then((rows) => {
        if (!cancelled) {
          setDrafts(rows)
          setLoading(false)
        }
      })
    })
    return () => { cancelled = true }
  }, [user, authLoading, router])

  return (
    <div className="design-tool-page-wrapper">
      <Navbar />
      <main className="design-tool-main dt-hub-main" role="main">
        <div className="dt-hub-header">
          <Link href="/design-tool" className="dt-hub-back">← Back</Link>
          <h1 className="dt-hub-title">My Drafts</h1>
        </div>

        {loading && (
          <div className="dt-hub-loading" role="status">Loading your drafts…</div>
        )}

        {!loading && drafts.length === 0 && (
          <div className="dt-hub-empty">
            <p>You have no drafts yet.</p>
            <Link href="/design-tool/new" className="dt-hub-cta-btn">
              Start a new design
            </Link>
          </div>
        )}

        {!loading && drafts.length > 0 && (
          <div className="dt-drafts-grid">
            {drafts.map((d) => (
              <DraftCard key={d.id} draft={d} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
