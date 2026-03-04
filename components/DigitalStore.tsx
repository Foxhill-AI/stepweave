'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, UserPlus, FileDown } from 'lucide-react'
import StoreContentSection from './StoreContentSection'
import { getActiveProducts, type ProductListingRow } from '@/lib/supabaseClient'
import '../styles/DigitalStore.css'

function productToStoreItem(p: ProductListingRow): StoreItem {
  return {
    id: String(p.id),
    title: p.name,
    author: p.user_account?.username ?? 'Unknown',
    image: (p.design_data as { imageUrl?: string } | null)?.imageUrl,
    likes: 0,
    downloads: 0,
    promotionalText: undefined,
  }
}

interface Profile {
  avatar: string
  name: string
  followers: string
  description: string
}

interface FeaturedItem {
  id: string
  title: string
  subtitle?: string
  author: string
  image?: string
}

interface StoreItem {
  id: string
  title: string
  author: string
  image?: string
  likes: number
  downloads: number
  promotionalText?: string
}

interface DigitalStoreProps {
  profile?: Profile
  /** Optional category slug to filter products (e.g. from URL ?category=digital). */
  categorySlug?: string | null
}

interface StoreSectionData {
  profile: Profile
  featuredItems: FeaturedItem[]
}

export default function DigitalStore({ profile, categorySlug }: DigitalStoreProps) {
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0)
  const [products, setProducts] = useState<StoreItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getActiveProducts(categorySlug ?? undefined)
      .then((rows) => {
        if (!cancelled) setProducts(rows.map(productToStoreItem))
      })
      .catch(() => {
        if (!cancelled) setProducts([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [categorySlug])

  // Multiple profiles with their featured items (like HeroSection)
  const storeSections: StoreSectionData[] = [
    {
      profile: {
        avatar: 'RB',
        name: 'RuvenBals',
        followers: '13K followers',
        description: 'Aggressive Tinkerer. Mechanics are my Canvas. Currently, exploring mechanical Fidget Toys.',
      },
      featuredItems: [
        {
          id: 'featured-1',
          title: 'Gear Ball Fidget Toy',
          subtitle: 'Gear Ball',
          author: 'RuvenBals',
        },
        {
          id: 'featured-2',
          title: 'Gear Ball 2.0',
          author: 'RuvenBals',
        },
        {
          id: 'featured-3',
          title: 'Gear Orb Fidget',
          author: 'RuvenBals',
        },
        {
          id: 'featured-4',
          title: 'Spin Ball',
          author: 'RuvenBals',
        },
      ],
    },
    {
      profile: {
        avatar: 'FM',
        name: 'Fotis Mint',
        followers: '14K followers',
        description: 'Creating Busts, Figures, and Miniatures for both resin and FDM 3D printing.',
      },
      featuredItems: [
        {
          id: 'featured-5',
          title: 'Mechanical Fidget Design',
          subtitle: 'Fidget Pro',
          author: 'Fotis Mint',
        },
        {
          id: 'featured-6',
          title: 'Abstract Sculpture Model',
          author: 'Fotis Mint',
        },
        {
          id: 'featured-7',
          title: 'Geometric Pattern Set',
          author: 'Fotis Mint',
        },
        {
          id: 'featured-8',
          title: 'Modern Robot Design',
          author: 'Fotis Mint',
        },
      ],
    },
    {
      profile: {
        avatar: 'DS',
        name: 'Design Studio',
        followers: '8.2k followers',
        description: 'Professional 3D models and digital art. High-quality assets for creators and designers.',
      },
      featuredItems: [
        {
          id: 'featured-9',
          title: 'Digital Art Collection',
          subtitle: 'Art Pack',
          author: 'Design Studio',
        },
        {
          id: 'featured-10',
          title: 'Typography Set',
          author: 'Design Studio',
        },
        {
          id: 'featured-11',
          title: 'Icon Collection',
          author: 'Design Studio',
        },
        {
          id: 'featured-12',
          title: 'Vector Graphics',
          author: 'Design Studio',
        },
      ],
    },
  ]

  // Use provided profile or default to first section
  const currentProfile = profile || storeSections[0].profile
  const currentSection = profile 
    ? { profile: currentProfile, featuredItems: storeSections[0].featuredItems }
    : storeSections[currentProfileIndex]

  const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState(0)

  const goToProfileSlide = (index: number) => {
    setCurrentProfileIndex(index)
    // Reset featured items carousel when profile changes
    setCurrentFeaturedIndex(0)
  }

  const goToProfilePrevious = () => {
    setCurrentProfileIndex((prev) =>
      prev === 0 ? storeSections.length - 1 : prev - 1
    )
    setCurrentFeaturedIndex(0)
  }

  const goToProfileNext = () => {
    setCurrentProfileIndex((prev) =>
      prev === storeSections.length - 1 ? 0 : prev + 1
    )
    setCurrentFeaturedIndex(0)
  }

  // Product sections from Supabase (same list, different slices for UI)
  const mostDownloaded = products.slice(0, 4)
  const popularItems = products.slice(4, 8)
  const popularMakes = products.slice(8, 12)

  const goToFeaturedSlide = (index: number) => {
    setCurrentFeaturedIndex(index)
  }

  const goToFeaturedPrevious = () => {
    setCurrentFeaturedIndex((prev) =>
      prev === 0 ? currentSection.featuredItems.length - 1 : prev - 1
    )
  }

  const goToFeaturedNext = () => {
    setCurrentFeaturedIndex((prev) =>
      prev === currentSection.featuredItems.length - 1 ? 0 : prev + 1
    )
  }

  return (
    <div className="digital-store">
      {/* Profile Header Section */}
      <section className="store-profile-section">
        <div className="store-container">
          {storeSections.length > 1 && !profile && (
            <>
              <button
                className="store-profile-nav store-profile-nav-left"
                onClick={goToProfilePrevious}
                aria-label="Previous profile"
              >
                <ChevronLeft size={24} aria-hidden="true" />
              </button>
              <button
                className="store-profile-nav store-profile-nav-right"
                onClick={goToProfileNext}
                aria-label="Next profile"
              >
                <ChevronRight size={24} aria-hidden="true" />
              </button>
            </>
          )}
          <div className="store-profile-layout">
            <div className="store-profile-card">
              <div className="store-profile-avatar">
                <span>{currentSection.profile.avatar}</span>
              </div>
              <div className="store-profile-info">
                <h1 className="store-profile-name">{currentSection.profile.name}</h1>
                <p className="store-profile-followers">{currentSection.profile.followers}</p>
              </div>
              <div className="store-profile-actions">
                <button className="store-follow-button">
                  Follow
                </button>
                <button className="store-member-button">
                  <UserPlus size={16} aria-hidden="true" />
                  Become a member
                </button>
              </div>
              <p className="store-profile-description">{currentSection.profile.description}</p>
              {/* Digital Store-specific indicator */}
              <div className="digital-store-header-badge">
                <FileDown size={16} />
                <span>Digital Downloads</span>
              </div>
            </div>

            {/* Featured Carousel */}
            <div className="store-featured-carousel">
              <div className="store-featured-wrapper">
                <div
                  className="store-featured-container"
                  style={{
                    transform: `translateX(-${currentFeaturedIndex * 100}%)`,
                  }}
                >
                  {currentSection.featuredItems.map((item) => (
                    <div key={item.id} className="store-featured-slide">
                      <div className="store-featured-image">
                        <div className="store-featured-image-placeholder">
                          {/* Placeholder for featured image */}
                        </div>
                      </div>
                      <div className="store-featured-content">
                        <h3 className="store-featured-title">{item.title}</h3>
                        {item.subtitle && (
                          <p className="store-featured-subtitle">{item.subtitle}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {currentSection.featuredItems.length > 1 && (
                  <div className="store-featured-indicators">
                    {currentSection.featuredItems.map((_, index) => (
                      <button
                        key={index}
                        className={`store-featured-dot ${index === currentFeaturedIndex ? 'active' : ''}`}
                        onClick={() => goToFeaturedSlide(index)}
                        aria-label={`Go to featured item ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {storeSections.length > 1 && !profile && (
            <div className="store-profile-indicators">
              <div className="store-profile-dots" role="tablist" aria-label="Featured profiles">
                {storeSections.map((_, index) => (
                  <button
                    key={index}
                    className={`store-profile-dot ${index === currentProfileIndex ? 'active' : ''}`}
                    onClick={() => goToProfileSlide(index)}
                    aria-label={`Go to profile ${index + 1}`}
                    aria-selected={index === currentProfileIndex}
                    role="tab"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Content Sections */}
      <div className="store-content">
        <div className="store-container">
          {loading && (
            <p className="store-loading" aria-live="polite">Loading products…</p>
          )}
          {!loading && products.length === 0 && (
            <p className="store-empty" aria-live="polite">No products found.</p>
          )}
          {!loading && mostDownloaded.length > 0 && (
            <StoreContentSection
              title="Most Downloaded"
              items={mostDownloaded}
            />
          )}
          {!loading && popularItems.length > 0 && (
            <StoreContentSection
              title="Popular"
              items={popularItems}
            />
          )}
          {!loading && popularMakes.length > 0 && (
            <StoreContentSection
              title="Popular Makes"
              items={popularMakes}
            />
          )}
        </div>
      </div>
    </div>
  )
}
