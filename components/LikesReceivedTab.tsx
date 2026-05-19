'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import ItemCard from './ItemCard'
import { getCreatorProductsWithLikes, type CreatorProductLikesRow } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'
import '../styles/LikesTab.css'

export default function LikesReceivedTab() {
  const { userAccount } = useAuth()
  const [rows, setRows] = useState<CreatorProductLikesRow[] | null>(null)

  useEffect(() => {
    if (!userAccount?.id) {
      setRows([])
      return
    }
    let cancelled = false
    setRows(null)
    getCreatorProductsWithLikes(userAccount.id).then((list) => {
      if (!cancelled) setRows(list)
    })
    return () => {
      cancelled = true
    }
  }, [userAccount?.id])

  if (rows === null) {
    return (
      <div className="likes-tab-loading">
        <p>Loading likes received…</p>
      </div>
    )
  }

  return (
    <div className="likes-tab">
      <div className="likes-tab-header">
        <h3 className="likes-tab-title">Likes Received</h3>
        <span className="likes-tab-count">
          {rows.length} {rows.length === 1 ? 'product' : 'products'}
        </span>
      </div>

      {rows.length > 0 ? (
        <div className="likes-tab-grid">
          {rows.map((product) => (
            <div key={product.productId} className="likes-received-item">
              <ItemCard
                id={String(product.productId)}
                title={product.name}
                category={product.category || 'Uncategorized'}
                image={product.image}
                productId={product.productId}
                designData={product.designData}
                likes={product.likes}
                author="You"
                price={product.price}
                badge={product.status === 'active' ? 'Published' : product.status === 'draft' ? 'Draft' : 'Archived'}
              />
              <div className="likes-received-badge" aria-label={`${product.likes} likes`}>
                <Heart size={14} aria-hidden />
                {product.likes}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="likes-tab-empty">
          <p>None of your products have received likes yet.</p>
          <p>
            <Link href="/profile?tab=products">Publish products</Link> to start getting likes from
            the community.
          </p>
        </div>
      )}
    </div>
  )
}
