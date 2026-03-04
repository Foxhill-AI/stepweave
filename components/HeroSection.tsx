'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, UserPlus } from 'lucide-react'
import ItemCard from '../components/ItemCard'
import { useAuth } from '@/components/AuthProvider'
import { isFollowing, followUser, unfollowUser, createNotification } from '@/lib/supabaseClient'
import '../styles/HeroSection.css'

export interface HeroProfile {
  avatar: string
  name: string
  followers: string
  description: string
  /** Creator username for profile link (e.g. /profile/username) */
  username?: string
  /** Creator user_account id for follow action (optional for fallback/static sections) */
  userAccountId?: number
}

export interface HeroItem {
  id: string
  title: string
  category: string
  image: string
  views?: number
  likes?: number
  downloads?: number
  author?: string
  price?: string
  rating?: number
  badge?: string
}

export interface HeroSectionData {
  profile: HeroProfile
  items: HeroItem[]
}

interface HeroSectionProps {
  sections: HeroSectionData[]
}

export default function HeroSection({ sections }: HeroSectionProps) {
  const { user, userAccount } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [followLoading, setFollowLoading] = useState(false)
  const [followingCreator, setFollowingCreator] = useState(false)

  const currentProfile = sections[currentIndex]?.profile
  const creatorId = currentProfile?.userAccountId

  useEffect(() => {
    if (!userAccount?.id || !creatorId || creatorId === userAccount.id) {
      setFollowingCreator(false)
      return
    }
    let cancelled = false
    isFollowing(userAccount.id, creatorId)
      .then((following) => {
        if (!cancelled) setFollowingCreator(following)
      })
      .catch(() => {
        if (!cancelled) setFollowingCreator(false)
      })
    return () => { cancelled = true }
  }, [userAccount?.id, creatorId, currentIndex])

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  const handleFollowClick = async () => {
    if (!userAccount?.id || !creatorId || creatorId === userAccount.id || followLoading) return
    setFollowLoading(true)
    const wasFollowing = followingCreator
    if (wasFollowing) {
      const { error } = await unfollowUser(userAccount.id, creatorId)
      if (!error) setFollowingCreator(false)
    } else {
      const { error } = await followUser(userAccount.id, creatorId)
      if (!error) {
        setFollowingCreator(true)
        createNotification(
          creatorId,
          'follow',
          `${userAccount.username || 'Someone'} started following you`,
          currentProfile?.username ? `/profile/${encodeURIComponent(currentProfile.username)}` : '/'
        ).catch(() => {})
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('notifications-updated'))
        }
      }
    }
    setFollowLoading(false)
  }

  const showFollowButton = Boolean(creatorId && userAccount?.id && creatorId !== userAccount.id)

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? sections.length - 1 : prevIndex - 1
    )
  }

  const goToNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === sections.length - 1 ? 0 : prevIndex + 1
    )
  }

  return (
    <section className="hero-section" aria-label="Featured content">
      <div className="hero-inner">
        {sections.length > 1 && (
          <>
            <button
              className="hero-carousel-nav hero-carousel-nav-left"
              onClick={goToPrevious}
              aria-label="Previous profile"
            >
              <ChevronLeft size={24} aria-hidden="true" />
            </button>
            <button
              className="hero-carousel-nav hero-carousel-nav-right"
              onClick={goToNext}
              aria-label="Next profile"
            >
              <ChevronRight size={24} aria-hidden="true" />
            </button>
          </>
        )}
        <div className="hero-container">
        <div className="hero-left">
          <div className="hero-profile-card">
            <div className="profile-avatar-large">
              {sections[currentIndex]?.profile.avatar?.startsWith('http') ? (
                <img src={sections[currentIndex].profile.avatar} alt="" className="profile-avatar-img" />
              ) : (
                <span>{sections[currentIndex]?.profile.avatar || 'K'}</span>
              )}
            </div>
            <h2 className="profile-name">
              {sections[currentIndex]?.profile.username ? (
                <Link href={`/profile/${encodeURIComponent(sections[currentIndex].profile.username)}`} className="profile-name-link">
                  {sections[currentIndex]?.profile.name || 'Kreations'}
                </Link>
              ) : (
                sections[currentIndex]?.profile.name || 'Kreations'
              )}
            </h2>
            <p className="profile-followers">{sections[currentIndex]?.profile.followers || '3.5k followers'}</p>
            <div className="profile-actions">
              {!user ? (
                <Link href="/?openAuth=1" className="profile-follow-button profile-follow-button-link">
                  Sign in to follow
                </Link>
              ) : showFollowButton ? (
                <button
                  type="button"
                  className={`profile-follow-button ${followingCreator ? 'following' : ''}`}
                  onClick={handleFollowClick}
                  disabled={followLoading}
                  aria-pressed={followingCreator}
                >
                  {followLoading ? '…' : followingCreator ? 'Following' : 'Follow'}
                </button>
              ) : creatorId === userAccount?.id ? (
                <span className="profile-follow-button profile-follow-you">You</span>
              ) : null}
              <Link href="/pricing" className="profile-member-button profile-member-button-link">
                <UserPlus size={16} aria-hidden="true" />
                Become a member
              </Link>
            </div>
            <p className="profile-description">
              {sections[currentIndex]?.profile.description || 'Bringing beautiful creatures to life with 3D printing. Explore unique designs and join our creative community.'}
            </p>
          </div>
        </div>

        <div className="hero-right">
          <div className="hero-carousel-wrapper">
            <div 
              className="hero-carousel-container"
              style={{
                transform: `translateX(-${currentIndex * 100}%)`,
              }}
            >
              {sections.map((section, sectionIndex) => (
                <div key={sectionIndex} className="hero-featured-item">
                  {section.items.map((item, itemIndex) => {
                    const { badge, ...itemWithoutBadge } = item
                    return (
                      <div key={item.id} className="hero-featured-item-inner">
                        {badge && (
                          <span className="hero-item-badge">{badge}</span>
                        )}
                        <ItemCard {...itemWithoutBadge} />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        {sections.length > 1 && (
          <div className="hero-carousel-indicators">
            <div className="hero-carousel-dots" role="tablist" aria-label="Featured profiles">
              {sections.map((section, index) => (
                <button
                  key={index}
                  className={`hero-carousel-dot ${index === currentIndex ? 'active' : ''}`}
                  onClick={() => goToSlide(index)}
                  aria-label={`Go to profile ${index + 1}`}
                  aria-selected={index === currentIndex}
                  role="tab"
                />
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </section>
  )
}
