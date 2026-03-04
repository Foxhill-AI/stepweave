'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import ProfileHeader from './ProfileHeader'
import ProfileTabs from './ProfileTabs'
import MyProductsTab from './MyProductsTab'
import OrdersTab, { type Order } from './OrdersTab'
import LikesTab, { type LikedProduct } from './LikesTab'
import SettingsTab from './SettingsTab'
import { useAuth } from '@/components/AuthProvider'
import { getOrdersByUserAccountId, getLikedProducts } from '@/lib/supabaseClient'
import type { OrderWithItemsRow } from '@/lib/supabaseClient'
import type { ProductListingRow } from '@/lib/supabaseClient'
import '../styles/ProfilePage.css'

// just testing the commit


type TabType = 'products' | 'orders' | 'liked' | 'settings'

/** Map product row to the shape LikesTab expects (id, title, category, image, etc.). */
function mapProductToLikedItem(row: ProductListingRow): LikedProduct {
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

/** Map DB order rows to the shape OrdersTab expects */
function mapOrdersForTab(rows: OrderWithItemsRow[]): Parameters<typeof OrdersTab>[0]['orders'] {
  return rows.map((o) => ({
    id: String(o.id),
    status: o.status as 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled',
    total_amount: String(Number(o.total_amount).toFixed(2)),
    currency: o.currency.toUpperCase(),
    created_at: o.created_at,
    paid_at: o.paid_at ?? undefined,
    shipping_address: o.shipping_address ?? undefined,
    items: (o.order_item ?? []).map((oi) => ({
      product_name: oi.product_name,
      variant_label: oi.variant_label ?? undefined,
      price: String(Number(oi.unit_price).toFixed(2)),
      quantity: oi.quantity,
      subtotal: String(Number(oi.subtotal).toFixed(2)),
    })),
  }))
}

interface ProfilePageProps {
  userData?: {
    avatar?: string
    username: string
    bio?: string
    joinedDate?: string
    followers?: number
    following?: number
    products?: number
    likes?: number
  }
}

function ProfilePageInner({ userData }: ProfilePageProps) {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>('products')
  const { userAccount } = useAuth()
  const [orders, setOrders] = useState<Order[] | undefined>(undefined)
  const [likedProducts, setLikedProducts] = useState<LikedProduct[] | undefined>(undefined)

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'orders' || tab === 'settings' || tab === 'liked') setActiveTab(tab)
  }, [searchParams])

  useEffect(() => {
    if (!userAccount?.id) {
      setOrders([])
      return
    }
    let cancelled = false
    getOrdersByUserAccountId(userAccount.id)
      .then((rows) => {
        if (!cancelled) setOrders(mapOrdersForTab(rows))
      })
      .catch(() => {
        if (!cancelled) setOrders([])
      })
    return () => { cancelled = true }
  }, [userAccount?.id])

  useEffect(() => {
    if (!userAccount?.id) {
      setLikedProducts([])
      return
    }
    let cancelled = false
    getLikedProducts(userAccount.id)
      .then((rows) => {
        if (!cancelled) setLikedProducts(rows.map(mapProductToLikedItem))
      })
      .catch(() => {
        if (!cancelled) setLikedProducts([])
      })
    return () => { cancelled = true }
  }, [userAccount?.id])

  useEffect(() => {
    if (!userAccount?.id) return
    const onCollectionUpdated = () => {
      getLikedProducts(userAccount.id)
        .then((rows) => setLikedProducts(rows.map(mapProductToLikedItem)))
        .catch(() => setLikedProducts([]))
    }
    window.addEventListener('collection-updated', onCollectionUpdated)
    return () => window.removeEventListener('collection-updated', onCollectionUpdated)
  }, [userAccount?.id])

  // Merge with defaults only for optional display fields; stats come from Supabase via userData
  const defaultUserData = {
    username: userData?.username ?? 'User',
    bio: userData?.bio,
    avatar: userData?.avatar,
    joinedDate: userData?.joinedDate,
    followers: userData?.followers ?? 0,
    following: userData?.following ?? 0,
    products: userData?.products ?? 0,
    likes: userData?.likes ?? 0,
  }

  const isCreatorRedirect = searchParams.get('creator') === '1'
  const profileIncomplete = !userAccount?.username || String(userAccount.username).trim() === ''
  const showCreatorSetupPrompt = isCreatorRedirect && profileIncomplete && (userAccount?.subscription_tier === 'starter' || userAccount?.subscription_tier === 'pro')

  return (
    <div className="profile-page">
      <div className="profile-page-container">
        {showCreatorSetupPrompt && (
          <div className="profile-creator-setup-prompt" role="status">
            <p className="profile-creator-setup-text">
              Set up your creator profile so others can find you: add a username and bio in Settings.
            </p>
            <button
              type="button"
              className="profile-creator-setup-btn"
              onClick={() => setActiveTab('settings')}
            >
              Set up creator profile
            </button>
          </div>
        )}
        <ProfileHeader
          avatar={defaultUserData.avatar}
          username={defaultUserData.username}
          bio={defaultUserData.bio}
          joinedDate={defaultUserData.joinedDate}
          followers={defaultUserData.followers}
          following={defaultUserData.following}
          products={defaultUserData.products}
          likes={defaultUserData.likes}
        />

        <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="profile-content" role="tabpanel">
          {activeTab === 'products' && <MyProductsTab />}
          {activeTab === 'orders' && <OrdersTab orders={orders} />}
          {activeTab === 'liked' && <LikesTab likedProducts={likedProducts} />}
          {activeTab === 'settings' && (
            <SettingsTab
              userData={defaultUserData}
              initialSubTab={searchParams.get('sub') === 'subscription' ? 'subscription' : undefined}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage(props: ProfilePageProps) {
  return (
    <Suspense fallback={<div className="profile-page"><div className="profile-page-container" /></div>}>
      <ProfilePageInner {...props} />
    </Suspense>
  )
}
