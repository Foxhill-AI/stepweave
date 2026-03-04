'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import MyCollection from '@/components/MyCollection'
import { useAuth } from '@/components/AuthProvider'
import { getSavedProducts, removeProductSave } from '@/lib/supabaseClient'
import type { ProductListingRow } from '@/lib/supabaseClient'

type CollectionItem = {
  id: string
  title: string
  category: string
  image?: string
  views?: number
  likes?: number
  downloads?: number
  author?: string
  price?: string
  rating?: number
  badge?: string
}

function productToCollectionItem(row: ProductListingRow): CollectionItem {
  const category = row.product_category?.[0]?.category
  const categoryLabel = category?.name ?? category?.slug ?? ''
  const designData = row.design_data as { imageUrl?: string } | null
  return {
    id: String(row.id),
    title: row.name,
    category: categoryLabel,
    image: designData?.imageUrl,
    views: 0,
    likes: 0,
    downloads: 0,
    author: row.user_account?.username ?? undefined,
    price: `$${Number(row.price).toFixed(2)}`,
    rating: 0,
  }
}

export default function CollectionPage() {
  const router = useRouter()
  const { user, userAccount, loading: authLoading } = useAuth()
  const [items, setItems] = useState<CollectionItem[] | undefined>(undefined)

  const fetchSaved = () => {
    if (!userAccount?.id) return
    getSavedProducts(userAccount.id)
      .then((rows) => setItems(rows.map(productToCollectionItem)))
      .catch(() => setItems([]))
  }

  useEffect(() => {
    if (authLoading || !userAccount?.id) {
      if (!authLoading && !user) setItems([])
      else if (userAccount?.id) fetchSaved()
      return
    }
    fetchSaved()
  }, [authLoading, user, userAccount?.id])

  useEffect(() => {
    if (!userAccount?.id) return
    const onCollectionUpdated = () => fetchSaved()
    window.addEventListener('collection-updated', onCollectionUpdated)
    return () => window.removeEventListener('collection-updated', onCollectionUpdated)
  }, [userAccount?.id])

  useEffect(() => {
    if (authLoading) return
    if (!user) router.replace('/')
  }, [user, authLoading, router])

  if (authLoading) {
    return (
      <div className="collection-page-wrapper">
        <Navbar />
        <Subnavbar />
        <main className="collection-main" role="main" style={{ padding: '2rem', textAlign: 'center' }}>
          Loading…
        </main>
        <Footer />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="collection-page-wrapper">
      <Navbar />
      <Subnavbar />
      <main className="collection-main" role="main">
        <MyCollection
          items={items}
          onUnsave={
            userAccount?.id
              ? (productId) => {
                  removeProductSave(userAccount.id, productId).then(fetchSaved)
                }
              : undefined
          }
        />
      </main>
      <Footer />
    </div>
  )
}
