'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import ProfileHeader from '@/components/ProfileHeader'
import ItemCard from '@/components/ItemCard'
import { useAuth } from '@/components/AuthProvider'
import {
  getPublicProfileByUsername,
  getProfileStats,
  getProductsByUserAccountId,
  isFollowing,
  followUser,
  unfollowUser,
  createNotification,
  type PublicProfileRow,
  type ProductListingRow,
} from '@/lib/supabaseClient'
import '@/styles/PublicProfile.css'

type ProfileStats = { followers: number; following: number; products: number; likesReceived: number }

function mapProductToItem(row: ProductListingRow) {
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

export default function PublicProfilePage() {
  const params = useParams()
  const username = (params?.username as string) ?? ''
  const { userAccount } = useAuth()
  const [profile, setProfile] = useState<PublicProfileRow | null>(null)
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [products, setProducts] = useState<ReturnType<typeof mapProductToItem>[]>([])
  const [loading, setLoading] = useState(true)
  const [isFollowingCreator, setIsFollowingCreator] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    if (!username) {
      setLoading(false)
      setProfile(null)
      setStats(null)
      setProducts([])
      return
    }
    let cancelled = false
    setLoading(true)
    getPublicProfileByUsername(username)
      .then((data) => {
        if (cancelled) return
        setProfile(data)
        if (!data) {
          setStats(null)
          setProducts([])
          return
        }
        Promise.all([
          getProfileStats(data.id),
          getProductsByUserAccountId(data.id),
        ]).then(([statsData, productsData]) => {
          if (cancelled) return
          setStats(statsData)
          const active = (productsData as ProductListingRow[]).filter((p) => p.status === 'active')
          setProducts(active.map(mapProductToItem))
        })
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [username])

  useEffect(() => {
    if (!profile?.id || !userAccount?.id || profile.id === userAccount.id) return
    let cancelled = false
    isFollowing(userAccount.id, profile.id)
      .then((following) => {
        if (!cancelled) setIsFollowingCreator(following)
      })
      .catch(() => {
        if (!cancelled) setIsFollowingCreator(false)
      })
    return () => { cancelled = true }
  }, [profile?.id, userAccount?.id])

  const handleFollowClick = async () => {
    if (!profile?.id || !userAccount?.id || followLoading) return
    setFollowLoading(true)
    const wasFollowing = isFollowingCreator
    if (wasFollowing) {
      const { error } = await unfollowUser(userAccount.id, profile.id)
      if (!error) {
        setIsFollowingCreator(false)
        getProfileStats(profile.id).then(setStats)
      }
    } else {
      const { error } = await followUser(userAccount.id, profile.id)
      if (!error) {
        setIsFollowingCreator(true)
        getProfileStats(profile.id).then(setStats)
        createNotification(
          profile.id,
          'follow',
          `${userAccount.username || 'Someone'} started following you`,
          `/profile/${encodeURIComponent(profile.username)}`
        ).catch(() => {})
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('notifications-updated'))
        }
      }
    }
    setFollowLoading(false)
  }

  const showFollowButton = Boolean(
    profile?.id && userAccount?.id && profile.id !== userAccount.id
  )

  if (loading) {
    return (
      <div className="profile-page-wrapper">
        <Navbar />
        <Subnavbar />
        <main className="profile-main" role="main">
          <p className="profile-loading">Loading…</p>
        </main>
        <Footer />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="profile-page-wrapper">
        <Navbar />
        <Subnavbar />
        <main className="profile-main" role="main">
          <p className="profile-not-found">
            Creator not found. <Link href="/">Go home</Link>
          </p>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="profile-page-wrapper">
      <Navbar />
      <Subnavbar />
      <main className="profile-main profile-main-public" role="main">
        <div className="public-profile-container">
          <ProfileHeader
            avatar={profile.avatar_url ?? undefined}
            username={profile.username}
            bio={profile.bio ?? undefined}
            followers={stats?.followers ?? 0}
            following={stats?.following ?? 0}
            products={stats?.products ?? 0}
            likes={stats?.likesReceived ?? 0}
          />
          {showFollowButton && (
            <div className="public-profile-actions">
              <button
                type="button"
                className={`public-profile-follow-btn ${isFollowingCreator ? 'following' : ''}`}
                onClick={handleFollowClick}
                disabled={followLoading}
                aria-pressed={isFollowingCreator}
              >
                {followLoading ? '…' : isFollowingCreator ? 'Following' : 'Follow'}
              </button>
            </div>
          )}
          <section className="public-profile-products" aria-label="Creator products">
            <h2 className="public-profile-products-title">
              Designs by {profile.username}
            </h2>
            {products.length > 0 ? (
              <div className="public-profile-products-grid">
                {products.map((item) => (
                  <ItemCard key={item.id} {...item} />
                ))}
              </div>
            ) : (
              <p className="public-profile-products-empty">
                No public designs yet.
              </p>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
