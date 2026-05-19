'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { User, ChevronRight } from 'lucide-react'
import { getFollowerAccounts, type FollowingAccountRow } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'
import '../styles/FollowingTab.css'

export default function FollowersTab() {
  const { userAccount } = useAuth()
  const [rows, setRows] = useState<FollowingAccountRow[] | null>(null)

  const loadFollowers = useCallback(() => {
    if (!userAccount?.id) {
      setRows([])
      return
    }
    getFollowerAccounts(userAccount.id).then((list) => {
      setRows(list)
    })
  }, [userAccount?.id])

  useEffect(() => {
    if (!userAccount?.id) {
      setRows([])
      return
    }
    let cancelled = false
    setRows(null)
    getFollowerAccounts(userAccount.id).then((list) => {
      if (!cancelled) setRows(list)
    })
    return () => {
      cancelled = true
    }
  }, [userAccount?.id])

  useEffect(() => {
    const onFollowingUpdated = () => loadFollowers()
    window.addEventListener('following-updated', onFollowingUpdated)
    return () => window.removeEventListener('following-updated', onFollowingUpdated)
  }, [loadFollowers])

  if (rows === null) {
    return <p className="following-tab-loading" aria-live="polite">Loading…</p>
  }

  if (rows.length === 0) {
    return (
      <p className="following-tab-empty" role="status">
        No followers yet. When someone follows you from your profile or a product page, they will
        appear here.
      </p>
    )
  }

  return (
    <div className="following-tab">
      <div className="likes-tab-header">
        <h3 className="likes-tab-title">Followers</h3>
        <span className="likes-tab-count">
          {rows.length} {rows.length === 1 ? 'follower' : 'followers'}
        </span>
      </div>
      <ul className="following-tab-list">
        {rows.map((acc) => {
          const profilePath = `/profile/${encodeURIComponent(acc.username)}`
          return (
            <li key={acc.id}>
              <div className="following-tab-item">
                <Link
                  href={profilePath}
                  className="following-tab-avatar-link"
                  aria-label={`View profile for ${acc.username}`}
                >
                  {acc.avatar_url ? (
                    <img src={acc.avatar_url} alt="" className="following-tab-avatar" />
                  ) : (
                    <div className="following-tab-avatar-placeholder" aria-hidden>
                      <User size={22} />
                    </div>
                  )}
                </Link>
                <div className="following-tab-body">
                  <Link href={profilePath} className="following-tab-name">
                    {acc.username}
                  </Link>
                  <Link href={profilePath} className="following-tab-products-cta">
                    View profile
                    <ChevronRight size={16} aria-hidden className="following-tab-cta-icon" />
                  </Link>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
