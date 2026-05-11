'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { User, ChevronRight } from 'lucide-react'
import { getFollowingAccounts, type FollowingAccountRow } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'
import '../styles/FollowingTab.css'

export default function FollowingTab() {
  const { userAccount } = useAuth()
  const [rows, setRows] = useState<FollowingAccountRow[] | null>(null)

  useEffect(() => {
    if (!userAccount?.id) {
      setRows([])
      return
    }
    let cancelled = false
    getFollowingAccounts(userAccount.id).then((list) => {
      if (!cancelled) setRows(list)
    })
    return () => {
      cancelled = true
    }
  }, [userAccount?.id])

  if (rows === null) {
    return <p className="following-tab-loading" aria-live="polite">Loading…</p>
  }

  if (rows.length === 0) {
    return (
      <p className="following-tab-empty" role="status">
        You are not following anyone yet. Follow creators from their profile or a product page, then open their
        storefront here to browse their designs.
      </p>
    )
  }

  return (
    <div className="following-tab">
      <p className="following-tab-intro">
        People you follow. Use <strong>View products</strong> to open their public shop and browse active
        designs.
      </p>
      <ul className="following-tab-list">
        {rows.map((acc) => {
          const profilePath = `/profile/${encodeURIComponent(acc.username)}`
          const productsHref = `${profilePath}#creator-products`
          return (
            <li key={acc.id}>
              <div className="following-tab-item">
                <Link
                  href={productsHref}
                  className="following-tab-avatar-link"
                  aria-label={`View products by ${acc.username}`}
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
                  <Link href={productsHref} className="following-tab-products-cta">
                    View products
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
