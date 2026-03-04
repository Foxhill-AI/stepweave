'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, UserPlus, ShoppingBag } from 'lucide-react'
import MarketplaceContentSection from './MarketplaceContentSection'
import { useAuth } from '@/components/AuthProvider'
import { showCartToast } from '@/components/ui/Toast'
import {
  getActiveProducts,
  getOrCreateCart,
  addCartItem,
  type ProductListingRow,
} from '@/lib/supabaseClient'
import '../styles/Marketplace.css'

function productToMarketplaceItem(p: ProductListingRow): MarketplaceItem {
  const firstVariant = p.product_variant?.[0]
  return {
    id: String(p.id),
    title: p.name,
    author: p.user_account?.username ?? 'Unknown',
    price: `$${Number(p.price).toFixed(2)}`,
    image: (p.design_data as { imageUrl?: string } | null)?.imageUrl,
    likes: 0,
    shippingInfo: 'Free shipping',
    inStock: true,
    promotionalText: undefined,
    firstVariantId: firstVariant?.id,
    unitPrice: firstVariant?.price_override != null ? Number(firstVariant.price_override) : Number(p.price),
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
  price: string
  image?: string
}

interface MarketplaceItem {
  id: string
  title: string
  author: string
  image?: string
  likes?: number
  price: string
  shippingInfo?: string
  inStock?: boolean
  promotionalText?: string
  firstVariantId?: number
  unitPrice?: number
}

interface MarketplaceProps {
  profile?: Profile
  /** Optional category slug to filter products (e.g. from URL ?category=print). */
  categorySlug?: string | null
}

interface MarketplaceSectionData {
  profile: Profile
  featuredItems: FeaturedItem[]
}

export default function Marketplace({ profile, categorySlug }: MarketplaceProps) {
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0)
  const [products, setProducts] = useState<MarketplaceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getActiveProducts(categorySlug ?? undefined)
      .then((rows) => {
        if (!cancelled) setProducts(rows.map(productToMarketplaceItem))
      })
      .catch(() => {
        if (!cancelled) setProducts([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [categorySlug])

  // Marketplace profiles with physical products
  const marketplaceSections: MarketplaceSectionData[] = [
    {
      profile: {
        avatar: 'AM',
        name: 'Artisan Makers',
        followers: '18K followers',
        description: 'Handcrafted physical products. Quality items shipped directly to your door.',
      },
      featuredItems: [
        {
          id: 'featured-1',
          title: 'Handcrafted Wooden Desk Organizer',
          subtitle: 'Premium Quality',
          author: 'Artisan Makers',
          price: '$89.99',
        },
        {
          id: 'featured-2',
          title: 'Custom 3D Printed Lamp',
          author: 'Artisan Makers',
          price: '$65.00',
        },
        {
          id: 'featured-3',
          title: 'Designer Phone Stand Set',
          author: 'Artisan Makers',
          price: '$45.99',
        },
        {
          id: 'featured-4',
          title: 'Premium Storage Solutions',
          author: 'Artisan Makers',
          price: '$120.00',
        },
      ],
    },
    {
      profile: {
        avatar: 'PM',
        name: 'Print Masters',
        followers: '22K followers',
        description: 'Professional 3D printed products. Ready to ship, made to order.',
      },
      featuredItems: [
        {
          id: 'featured-5',
          title: 'Custom Action Figure',
          subtitle: 'Made to Order',
          author: 'Print Masters',
          price: '$75.00',
        },
        {
          id: 'featured-6',
          title: 'Mechanical Keyboard Case',
          author: 'Print Masters',
          price: '$95.00',
        },
        {
          id: 'featured-7',
          title: 'Gaming Accessories Set',
          author: 'Print Masters',
          price: '$55.00',
        },
        {
          id: 'featured-8',
          title: 'Custom Miniature Collection',
          author: 'Print Masters',
          price: '$125.00',
        },
      ],
    },
    {
      profile: {
        avatar: 'HC',
        name: 'Home Creations',
        followers: '15K followers',
        description: 'Beautiful home decor and functional items. Shipped worldwide.',
      },
      featuredItems: [
        {
          id: 'featured-9',
          title: 'Modern Wall Art Set',
          subtitle: 'Limited Edition',
          author: 'Home Creations',
          price: '$150.00',
        },
        {
          id: 'featured-10',
          title: 'Decorative Vase Collection',
          author: 'Home Creations',
          price: '$80.00',
        },
        {
          id: 'featured-11',
          title: 'Kitchen Organizer System',
          author: 'Home Creations',
          price: '$110.00',
        },
        {
          id: 'featured-12',
          title: 'Custom Planters Set',
          author: 'Home Creations',
          price: '$70.00',
        },
      ],
    },
  ]

  const currentProfile = profile || marketplaceSections[0].profile
  const currentSection = profile 
    ? { profile: currentProfile, featuredItems: marketplaceSections[0].featuredItems }
    : marketplaceSections[currentProfileIndex]

  const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState(0)

  const goToProfileSlide = (index: number) => {
    setCurrentProfileIndex(index)
    setCurrentFeaturedIndex(0)
  }

  const goToProfilePrevious = () => {
    setCurrentProfileIndex((prev) =>
      prev === 0 ? marketplaceSections.length - 1 : prev - 1
    )
    setCurrentFeaturedIndex(0)
  }

  const goToProfileNext = () => {
    setCurrentProfileIndex((prev) =>
      prev === marketplaceSections.length - 1 ? 0 : prev + 1
    )
    setCurrentFeaturedIndex(0)
  }

  // Product sections from Supabase (same list, different slices for UI)
  const bestSellers = products.slice(0, 4)
  const newArrivals = products.slice(4, 8)
  const featuredSellers = products.slice(8, 12)

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

  const { userAccount } = useAuth()
  const handleAddToCart = useCallback(
    async (variantId: number, quantity: number, unitPrice: number) => {
      if (!userAccount?.id) return
      const cart = await getOrCreateCart(userAccount.id)
      if (!cart) return
      const result = await addCartItem(cart.id, variantId, quantity, unitPrice)
      if (result) {
        window.dispatchEvent(new CustomEvent('cart-updated'))
        showCartToast()
      }
    },
    [userAccount?.id]
  )

  return (
    <div className="marketplace">
      {/* Profile Header Section */}
      <section className="marketplace-profile-section">
        <div className="marketplace-container">
          {marketplaceSections.length > 1 && !profile && (
            <>
              <button
                className="marketplace-profile-nav marketplace-profile-nav-left"
                onClick={goToProfilePrevious}
                aria-label="Previous profile"
              >
                <ChevronLeft size={24} aria-hidden="true" />
              </button>
              <button
                className="marketplace-profile-nav marketplace-profile-nav-right"
                onClick={goToProfileNext}
                aria-label="Next profile"
              >
                <ChevronRight size={24} aria-hidden="true" />
              </button>
            </>
          )}
          <div className="marketplace-profile-layout">
            <div className="marketplace-profile-card">
              <div className="marketplace-profile-avatar">
                <span>{currentSection.profile.avatar}</span>
              </div>
              <div className="marketplace-profile-info">
                <h1 className="marketplace-profile-name">{currentSection.profile.name}</h1>
                <p className="marketplace-profile-followers">{currentSection.profile.followers}</p>
              </div>
              <div className="marketplace-profile-actions">
                <button className="marketplace-follow-button">
                  Follow
                </button>
                <button className="marketplace-member-button">
                  <UserPlus size={16} aria-hidden="true" />
                  Become a member
                </button>
              </div>
              <p className="marketplace-profile-description">{currentSection.profile.description}</p>
              {/* Marketplace-specific indicator */}
              <div className="marketplace-profile-badge">
                <ShoppingBag size={16} />
                <span>Physical Products Store</span>
              </div>
            </div>

            {/* Featured Carousel */}
            <div className="marketplace-featured-carousel">
              <div className="marketplace-featured-wrapper">
                <div
                  className="marketplace-featured-container"
                  style={{
                    transform: `translateX(-${currentFeaturedIndex * 100}%)`,
                  }}
                >
                  {currentSection.featuredItems.map((item) => (
                    <div key={item.id} className="marketplace-featured-slide">
                      <div className="marketplace-featured-image">
                        <div className="marketplace-featured-image-placeholder">
                          {/* Placeholder for featured image */}
                        </div>
                      </div>
                      <div className="marketplace-featured-content">
                        <h3 className="marketplace-featured-title">{item.title}</h3>
                        {item.subtitle && (
                          <p className="marketplace-featured-subtitle">{item.subtitle}</p>
                        )}
                        <div className="marketplace-featured-price">{item.price}</div>
                        <button className="marketplace-featured-buy-button">
                          <ShoppingBag size={18} />
                          Buy Now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {currentSection.featuredItems.length > 1 && (
                  <div className="marketplace-featured-indicators">
                    {currentSection.featuredItems.map((_, index) => (
                      <button
                        key={index}
                        className={`marketplace-featured-dot ${index === currentFeaturedIndex ? 'active' : ''}`}
                        onClick={() => goToFeaturedSlide(index)}
                        aria-label={`Go to featured item ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {marketplaceSections.length > 1 && !profile && (
            <div className="marketplace-profile-indicators">
              <div className="marketplace-profile-dots" role="tablist" aria-label="Featured profiles">
                {marketplaceSections.map((_, index) => (
                  <button
                    key={index}
                    className={`marketplace-profile-dot ${index === currentProfileIndex ? 'active' : ''}`}
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
      <div className="marketplace-content">
        <div className="marketplace-container">
          {loading && (
            <p className="marketplace-loading" aria-live="polite">Loading products…</p>
          )}
          {!loading && products.length === 0 && (
            <p className="marketplace-empty" aria-live="polite">No products found.</p>
          )}
          {!loading && bestSellers.length > 0 && (
            <MarketplaceContentSection
              title="Best Sellers"
              items={bestSellers}
              onAddToCart={handleAddToCart}
            />
          )}
          {!loading && newArrivals.length > 0 && (
            <MarketplaceContentSection
              title="New Arrivals"
              items={newArrivals}
              onAddToCart={handleAddToCart}
            />
          )}
          {!loading && featuredSellers.length > 0 && (
            <MarketplaceContentSection
              title="Featured Sellers"
              items={featuredSellers}
              onAddToCart={handleAddToCart}
            />
          )}
        </div>
      </div>
    </div>
  )
}
