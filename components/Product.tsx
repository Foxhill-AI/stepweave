'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Heart, Share2, Bookmark, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, User, Clock, Download, Eye } from 'lucide-react'
import ItemCard from './ItemCard'
import Carousel from './Carousel'
import { useAuth } from '@/components/AuthProvider'
import { isFollowing as getIsFollowing, followUser, unfollowUser, createNotification } from '@/lib/supabaseClient'
import '../styles/Product.css'

const COLOR_LABEL_TO_HEX: Record<string, string> = {
  red: '#dc2626',
  blue: '#2563eb',
  black: '#171717',
  white: '#fafafa',
  green: '#16a34a',
  yellow: '#ca8a04',
  orange: '#ea580c',
  purple: '#9333ea',
  pink: '#db2777',
  gray: '#6b7280',
  grey: '#6b7280',
  brown: '#78350f',
  navy: '#1e3a8a',
  beige: '#d4b896',
  gold: '#b45309',
  silver: '#737373',
}

function labelToColorHex(label: string): string | null {
  const key = label.trim().toLowerCase()
  return COLOR_LABEL_TO_HEX[key] ?? null
}

interface ProductImage {
  url: string
  alt: string
}

interface ProductTag {
  label: string
}

interface Creator {
  name: string
  avatar?: string
  followers: string
  /** Creator's bio (shown in creator area when set). */
  bio?: string
  description?: string
  /** When set, creator name/block links to this profile URL. */
  profileUrl?: string
}

interface PrintingSettings {
  filament?: string
  material?: string
  layerHeight?: string
  infillDensity?: string
  supports?: string
  brim?: string
}

interface RelatedItem {
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

export type ProductAttributeOption = {
  id: number
  name: string
  options: { id: number; label: string }[]
}

export type ProductVariantOption = {
  variantId: number
  priceOverride: number | null
  optionIds: number[]
}

interface ProductProps {
  id: string
  title?: string
  category?: string
  images?: ProductImage[]
  views?: number
  likes?: number
  downloads?: number
  author?: string
  price?: string
  basePrice?: number
  rating?: number
  badge?: string
  tags?: ProductTag[]
  creator?: Creator
  timeAgo?: string
  description?: string
  printingSettings?: {
    fdm?: PrintingSettings
    resin?: PrintingSettings
  }
  relatedItems?: RelatedItem[]
  isMember?: boolean
  /** Attributes (e.g. Color, Size) and options for variant selection */
  attributes?: ProductAttributeOption[]
  /** Variants with their attribute option ids (for resolving selection to variant) */
  variants?: ProductVariantOption[]
  /** Called when user clicks Add to cart; variantId, quantity, unit price, and optional display label for the selected variant (e.g. "Red" or "Red / M"). */
  onAddToCart?: (variantId: number, quantity: number, unitPrice: number, variantLabel?: string) => void
  /** Called when user clicks Add to cart but variant is incomplete. Receives names of attributes still missing a selection. */
  onVariantRequired?: (missingAttributeNames: string[]) => void
  /** Called when variant selection changes (e.g. to clear "select variant" error). */
  onVariantSelectionChange?: () => void
  /** When provided, like button is controlled (e.g. synced with Supabase). */
  isLiked?: boolean
  onLikeToggle?: () => void
  /** When provided, save (collection) button is controlled. */
  isSaved?: boolean
  onSaveToggle?: () => void
  /** Creator's user_account id (for follow button; only shown when logged in and not own product). */
  creatorUserAccountId?: number
}

function findVariantIdFromSelection(
  variants: ProductVariantOption[],
  selectedOptionIds: Record<number, number>
): number | null {
  const selected = Object.values(selectedOptionIds)
    .filter((id) => id != null)
    .map((id) => Number(id))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b)

  // ✅ CASO ESPECIAL PRIMERO: productos con una sola variante
  // Si solo hay una variante, retornarla una vez que el usuario haya seleccionado algo
  if (variants.length === 1) {
    const singleVariant = variants[0]
    const variantOpts = (singleVariant.optionIds ?? [])
      .map((id) => Number(id))
      .filter((n) => !Number.isNaN(n))

    // Si la variante no tiene opciones (común en productos de variante única),
    // o el usuario ha seleccionado al menos una opción, retornar esta variante
    if (variantOpts.length === 0 || selected.length >= 1) {
      return singleVariant.variantId
    }
  }

  // Si no hay selecciones aún, retornar null
  if (selected.length === 0) return null

  // Productos multi-variante: buscar coincidencia exacta
  for (const v of variants) {
    const variantOpts = (v.optionIds ?? [])
      .map((id) => Number(id))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b)
    if (variantOpts.length === selected.length && variantOpts.every((id, i) => id === selected[i])) {
      return v.variantId
    }
  }

  // Fallback: una variante contiene todas las opciones seleccionadas (p. ej. un solo atributo)
  const withSelected = variants.filter((v) => {
    const opts = (v.optionIds ?? []).map((id) => Number(id)).filter((n) => !Number.isNaN(n))
    return selected.every((s) => opts.includes(s))
  })
  if (withSelected.length === 1) return withSelected[0].variantId

  // Fallback cuando la API no devuelve optionIds (todas las variantes con optionIds vacíos):
  // el usuario ya eligió algo; usar la primera variante para desbloquear add to cart.
  if (selected.length >= 1 && variants.length >= 1) {
    const allEmpty = variants.every((v) => (v.optionIds ?? []).length === 0)
    if (allEmpty) return variants[0].variantId
  }

  return null
}

export default function Product({ 
  id,
  title,
  category,
  images = [],
  views = 0,
  likes = 0,
  downloads = 0,
  author,
  price,
  basePrice,
  rating = 0,
  badge,
  tags = [],
  creator,
  timeAgo,
  description,
  printingSettings,
  relatedItems = [],
  isMember = false,
  attributes = [],
  variants = [],
  onAddToCart,
  onVariantRequired,
  onVariantSelectionChange,
  isLiked: isLikedProp,
  onLikeToggle,
  isSaved: isSavedProp,
  onSaveToggle,
  creatorUserAccountId,
}: ProductProps) {
  const { userAccount } = useAuth()
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false)
  const [localLiked, setLocalLiked] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const isLiked = onLikeToggle !== undefined && isLikedProp !== undefined ? isLikedProp : localLiked
  const handleLikeClick = onLikeToggle ? () => onLikeToggle() : () => setLocalLiked((prev) => !prev)
  const isSaved = isSavedProp ?? false
  const handleSaveClick = onSaveToggle ?? (() => {})

  const showFollowButton = Boolean(
    userAccount?.id && creatorUserAccountId != null && creatorUserAccountId !== userAccount.id
  )

  useEffect(() => {
    if (!showFollowButton) return
    let cancelled = false
    getIsFollowing(userAccount!.id, creatorUserAccountId!)
      .then((following) => {
        if (!cancelled) setIsFollowing(following)
      })
      .catch(() => {
        if (!cancelled) setIsFollowing(false)
      })
    return () => { cancelled = true }
  }, [showFollowButton, userAccount?.id, creatorUserAccountId])

  const handleFollowClick = async () => {
    if (!userAccount?.id || creatorUserAccountId == null || followLoading) return
    setFollowLoading(true)
    const wasFollowing = isFollowing
    if (wasFollowing) {
      const { error } = await unfollowUser(userAccount.id, creatorUserAccountId)
      if (!error) setIsFollowing(false)
    } else {
      const { error } = await followUser(userAccount.id, creatorUserAccountId)
      if (!error) {
        setIsFollowing(true)
        const msg = `${userAccount.username || 'Someone'} started following you`
        const link = productData.creator?.profileUrl ?? (productData.creator?.name ? `/profile/${encodeURIComponent(productData.creator.name)}` : null)
        createNotification(creatorUserAccountId, 'follow', msg, link).catch(() => {})
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('notifications-updated'))
      }
    }
    setFollowLoading(false)
  }
  /** One option per attribute (attributeId -> optionId) for variant selection */
  const [selectedOptionByAttribute, setSelectedOptionByAttribute] = useState<Record<number, number>>({})
  const [addToCartQuantity, setAddToCartQuantity] = useState(1)

  const selectedVariantId = variants.length > 0 && attributes.length > 0
    ? findVariantIdFromSelection(variants, selectedOptionByAttribute)
    : variants[0]?.variantId ?? null
  const selectedVariant = variants.find((v) => v.variantId === selectedVariantId)
  const displayPrice =
    selectedVariant?.priceOverride != null
      ? selectedVariant.priceOverride
      : basePrice != null
        ? basePrice
        : price
  const displayPriceStr =
    typeof displayPrice === 'number' ? `$${displayPrice.toFixed(2)}` : (displayPrice ?? price ?? '')
  const variantIdForCart = attributes.length === 0 ? (variants[0]?.variantId ?? null) : selectedVariantId
  /** Display label for the selected variant (e.g. "Red" or "Red / M") for cart display when product_variant_attribute_option is empty. */
  const selectedVariantLabel =
    variantIdForCart != null && attributes.length > 0
      ? attributes
          .map((attr) => {
            const optionId = selectedOptionByAttribute[attr.id]
            const opt = attr.options.find((o) => o.id === optionId)
            return opt?.label
          })
          .filter(Boolean)
          .join(' / ')
      : ''
  const unitPriceForCart =
    typeof displayPrice === 'number'
      ? displayPrice
      : typeof basePrice === 'number'
        ? basePrice
        : parseFloat(String(price ?? 0).replace(/[^0-9.-]/g, '')) || 0
  /** When product has variant options, user must select before adding; otherwise add is allowed. */
  const hasVariantsRequiringSelection = attributes.length > 0 && variants.length > 0
  const showAddButton = Boolean(onAddToCart)

  // Product data - memoized and only recalculates when product props change
  const productData = useMemo(() => {
    if (images.length === 0 && !creator) {
      return {
        id,
        title: 'Product',
        category: '',
        images: [{ url: '', alt: 'Product' }],
        views: 0,
        likes: 0,
        downloads: 0,
        author: undefined,
        price: undefined,
        rating: 0,
        badge: undefined,
        tags: [],
        creator: undefined,
        timeAgo: undefined,
        description: undefined,
        printingSettings: undefined,
        relatedItems: [],
        isMember: false,
        _isMissing: true as const,
      }
    }

    return {
      id,
      title: title || `Product ${id}`,
      category: category || 'Uncategorized',
      images: images.length > 0 ? images : [{ url: '', alt: title || 'Product' }],
      views,
      likes,
      downloads,
      author,
      price,
      rating,
      badge,
      tags: tags || [],
      creator,
      timeAgo,
      description,
      printingSettings,
      relatedItems: relatedItems || [],
      isMember,
    }
  }, [
    id, 
    title, 
    category, 
    // Use JSON.stringify for arrays/objects to ensure stable comparison
    // This prevents recalculation when array reference changes but content is the same
    JSON.stringify(images), 
    views, 
    likes, 
    downloads, 
    author, 
    price, 
    rating, 
    badge, 
    JSON.stringify(tags), 
    creator, 
    timeAgo, 
    description, 
    JSON.stringify(printingSettings), 
    JSON.stringify(relatedItems), 
    isMember,
    basePrice,
    JSON.stringify(attributes),
    JSON.stringify(variants),
  ])

  // Get current image based on selected index - this is the ONLY thing that changes
  // when navigating the gallery. All product information stays constant.
  const currentImage = productData.images?.[selectedImageIndex] || productData.images?.[0] || { url: '', alt: productData.title || 'Product' }
  const totalImages = productData.images?.length || 0

  // Image navigation handlers - only update selectedImageIndex state
  // These do NOT affect productData in any way
  const handlePreviousImage = () => {
    setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : totalImages - 1))
  }

  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev < totalImages - 1 ? prev + 1 : 0))
  }

  const handleThumbnailClick = (index: number) => {
    setSelectedImageIndex(index)
  }

  if ('_isMissing' in productData && productData._isMissing) {
    return (
      <div className="product-page product-missing">
        <div className="product-container">
          <div className="product-missing-content">
            <p className="product-missing-title">Product data is missing or not available</p>
            <p className="product-missing-description">
              This product may have been removed or the details are still being updated.
            </p>
            <a href="/marketplace" className="product-missing-link">Browse marketplace</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="product-page">
      <div className="product-container">
        {/* Main Product Section */}
        <div className="product-main">
          {/* Left Panel - Image Gallery */}
          <div className="product-gallery">
            <div className="product-gallery-main">
              {/* Thumbnail Carousel - Left Side */}
              {totalImages > 1 && productData.images && (
                <div className="product-thumbnails">
                  {productData.images.map((image, index) => (
                    <button
                      key={index}
                      className={`product-thumbnail ${index === selectedImageIndex ? 'active' : ''}`}
                      onClick={() => handleThumbnailClick(index)}
                      aria-label={`View image ${index + 1}`}
                    >
                      {image.url ? (
                        <img src={image.url} alt={image.alt} />
                      ) : (
                        <div className="product-thumbnail-fallback">
                          <span>{index + 1}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Main Image - Right Side */}
              <div className="product-main-image-wrapper">
                {currentImage.url ? (
                  <img
                    src={currentImage.url}
                    alt={currentImage.alt}
                    className="product-main-image"
                  />
                ) : (
                  <div className="product-main-image-fallback">
                    <span>{(productData.title || 'Product').charAt(0).toUpperCase()}</span>
                  </div>
                )}
                
                {/* Title Overlay */}
                <div className="product-title-overlay">
                  <h1 className="product-title-overlay-text">{productData.title}</h1>
                </div>

                {/* Badge Overlay */}
                {productData.badge && (
                  <div className="product-badge-overlay">
                    {productData.badge}
                  </div>
                )}

                {/* Navigation Arrows */}
                {totalImages > 1 && (
                  <>
                    <button
                      className="product-nav-button product-nav-button-left"
                      onClick={handlePreviousImage}
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button
                      className="product-nav-button product-nav-button-right"
                      onClick={handleNextImage}
                      aria-label="Next image"
                    >
                      <ChevronRight size={24} />
                    </button>
                  </>
                )}

                {/* Image Counter */}
                {totalImages > 1 && (
                  <div className="product-image-counter">
                    {productData.author || 'Creator'} Image {selectedImageIndex + 1} of {totalImages}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Product Details */}
          <div className="product-details">
            {/* Title */}
            <h1 className="product-details-title">{productData.title}</h1>

            {/* Stats and Meta */}
            <div className="product-stats">
              <span className="product-stat" aria-label={`${productData.views ?? 0} views`}>
                <Eye size={16} />
                {(productData.views ?? 0) >= 1000
                  ? `${((productData.views ?? 0) / 1000).toFixed(1)}k`
                  : productData.views ?? 0} views
              </span>
              <span className="product-stat">
                <Download size={16} />
                {(productData.downloads || 0) >= 1000 
                  ? `${((productData.downloads || 0) / 1000).toFixed(1)}k` 
                  : productData.downloads || 0} downloads
              </span>
              {productData.timeAgo && (
                <span className="product-stat">
                  <Clock size={16} />
                  {productData.timeAgo}
                </span>
              )}
            </div>

            {/* Tags */}
            {productData.tags && productData.tags.length > 0 && (
              <div className="product-tags">
                {productData.tags.map((tag, index) => (
                  <span key={index} className="product-tag">
                    {tag.label}
                  </span>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="product-actions">
              <button
                className={`product-action-button ${isLiked ? 'liked' : ''}`}
                onClick={handleLikeClick}
                aria-label={isLiked ? 'Unlike' : 'Like'}
              >
                <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
                <span>{productData.likes}</span>
              </button>
              {onSaveToggle && (
                <button
                  type="button"
                  className={`product-action-button ${isSaved ? 'saved' : ''}`}
                  onClick={handleSaveClick}
                  aria-label={isSaved ? 'Remove from collection' : 'Save to collection'}
                >
                  <Bookmark size={20} fill={isSaved ? 'currentColor' : 'none'} />
                  <span>{isSaved ? 'Saved' : 'Save'}</span>
                </button>
              )}
              <button
                className="product-action-button"
                aria-label="Share"
              >
                <Share2 size={20} />
              </button>
            </div>

            {/* Creator Info */}
            {productData.creator && (
              <div className="product-creator">
                <div className="product-creator-info">
                  {productData.creator.profileUrl ? (
                    <Link
                      href={productData.creator.profileUrl}
                      className="product-creator-link"
                      aria-label={`View ${productData.creator.name}'s profile`}
                    >
                      {productData.creator.avatar ? (
                        <img
                          src={productData.creator.avatar}
                          alt=""
                          className="product-creator-avatar"
                        />
                      ) : (
                        <div className="product-creator-avatar-placeholder">
                          <User size={20} />
                        </div>
                      )}
                      <div className="product-creator-details">
                        <div className="product-creator-name">{productData.creator.name}</div>
                        <div className="product-creator-followers">
                          {productData.creator.bio?.trim() ? productData.creator.bio : productData.creator.followers}
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <>
                      {productData.creator.avatar ? (
                        <img
                          src={productData.creator.avatar}
                          alt={productData.creator.name}
                          className="product-creator-avatar"
                        />
                      ) : (
                        <div className="product-creator-avatar-placeholder">
                          <User size={20} />
                        </div>
                      )}
                      <div className="product-creator-details">
                        <div className="product-creator-name">{productData.creator.name}</div>
                        <div className="product-creator-followers">
                          {productData.creator.bio?.trim() ? productData.creator.bio : productData.creator.followers}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {showFollowButton && (
                  <button
                    type="button"
                    className={`product-follow-button ${isFollowing ? 'following' : ''}`}
                    onClick={handleFollowClick}
                    disabled={followLoading}
                    aria-pressed={isFollowing}
                  >
                    {followLoading ? '…' : isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            )}

            {/* Variant attributes (Color, Size, etc.) - below creator, above price */}
            {attributes.length > 0 && (
              <div className="product-attributes">
                {attributes.map((attr) => {
                  const isColor = attr.name.toLowerCase() === 'color'
                  return (
                    <div key={attr.id} className="product-attribute-group">
                      <span className="product-attribute-label">{attr.name}</span>
                      <div className="product-attribute-options">
                        {attr.options.map((opt) => {
                          const swatchHex = isColor ? labelToColorHex(opt.label) : null
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              className={`product-attribute-option ${selectedOptionByAttribute[attr.id] === opt.id ? 'selected' : ''} ${isColor ? 'product-attribute-option-color' : ''}`}
                              onClick={() => {
                                setSelectedOptionByAttribute((prev) => ({ ...prev, [attr.id]: opt.id }))
                                onVariantSelectionChange?.()
                              }}
                              title={opt.label}
                            >
                              {isColor && swatchHex && (
                                <span
                                  className="product-attribute-swatch"
                                  style={{ background: swatchHex }}
                                  aria-hidden
                                />
                              )}
                              <span className="product-attribute-option-label">{opt.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {attributes.length > 0 && !selectedVariantId && (
                  <p className="product-attribute-hint">Select options to add to cart.</p>
                )}
              </div>
            )}

            {/* Price */}
            <div className="product-price-block">
              <span className="product-price-label">Price</span>
              <span className="product-price-value">{displayPriceStr}</span>
            </div>

            {/* Quantity + Add to cart (when onAddToCart provided) */}
            {onAddToCart && (
              <div className="product-add-to-cart">
                <div className="product-quantity-row">
                  <label htmlFor="product-quantity" className="product-quantity-label">Quantity</label>
                  <input
                    id="product-quantity"
                    type="number"
                    min={1}
                    value={addToCartQuantity}
                    onChange={(e) => setAddToCartQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="product-quantity-input"
                  />
                </div>
                <button
                  type="button"
                  className="product-add-to-cart-button"
                  disabled={!showAddButton}
                  onClick={() => {
                    if (hasVariantsRequiringSelection && variantIdForCart == null) {
                      const missingAttributeNames = attributes
                        .filter((attr) => selectedOptionByAttribute[attr.id] == null)
                        .map((attr) => attr.name)
                      onVariantRequired?.(missingAttributeNames)
                      return
                    }
                    if (variantIdForCart != null) {
                      onAddToCart?.(variantIdForCart, addToCartQuantity, unitPriceForCart, selectedVariantLabel || undefined)
                    }
                  }}
                >
                  Add to cart
                </button>
              </div>
            )}

            {/* Download Section */}
            <div className="product-download">
              {productData.isMember ? (
                <button className="product-download-button">
                  Download
                </button>
              ) : (
                <>
                  <button className="product-download-button product-download-button-member">
                    Become a member to download
                  </button>
                  <p className="product-download-note">
                    This model is enabled by Operating Tools. View license.
                  </p>
                </>
              )}
            </div>

            {/* Instructions Section (Collapsible) */}
            {productData.printingSettings && (
              <div className="product-instructions">
                <button
                  className="product-instructions-toggle"
                  onClick={() => setIsInstructionsOpen(!isInstructionsOpen)}
                  aria-expanded={isInstructionsOpen}
                >
                  <span>Instructions</span>
                  {isInstructionsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                {isInstructionsOpen && (
                  <div className="product-instructions-content">
                    {productData.printingSettings.fdm && (
                      <div className="product-printing-settings">
                        <h3 className="product-printing-title">FDM Settings</h3>
                        <div className="product-printing-grid">
                          {productData.printingSettings.fdm.filament && (
                            <div className="product-printing-item">
                              <span className="product-printing-label">Filament:</span>
                              <span className="product-printing-value">{productData.printingSettings.fdm.filament}</span>
                            </div>
                          )}
                          {productData.printingSettings.fdm.material && (
                            <div className="product-printing-item">
                              <span className="product-printing-label">Material:</span>
                              <span className="product-printing-value">{productData.printingSettings.fdm.material}</span>
                            </div>
                          )}
                          {productData.printingSettings.fdm.layerHeight && (
                            <div className="product-printing-item">
                              <span className="product-printing-label">Layer height:</span>
                              <span className="product-printing-value">{productData.printingSettings.fdm.layerHeight}</span>
                            </div>
                          )}
                          {productData.printingSettings.fdm.infillDensity && (
                            <div className="product-printing-item">
                              <span className="product-printing-label">Infill density:</span>
                              <span className="product-printing-value">{productData.printingSettings.fdm.infillDensity}</span>
                            </div>
                          )}
                          {productData.printingSettings.fdm.supports && (
                            <div className="product-printing-item">
                              <span className="product-printing-label">Supports:</span>
                              <span className="product-printing-value">{productData.printingSettings.fdm.supports}</span>
                            </div>
                          )}
                          {productData.printingSettings.fdm.brim && (
                            <div className="product-printing-item">
                              <span className="product-printing-label">Brim:</span>
                              <span className="product-printing-value">{productData.printingSettings.fdm.brim}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {productData.printingSettings.resin && (
                      <div className="product-printing-settings">
                        <h3 className="product-printing-title">Resin Settings</h3>
                        <div className="product-printing-grid">
                          {productData.printingSettings.resin.layerHeight && (
                            <div className="product-printing-item">
                              <span className="product-printing-label">Layer thickness:</span>
                              <span className="product-printing-value">{productData.printingSettings.resin.layerHeight}</span>
                            </div>
                          )}
                          {productData.printingSettings.resin.supports && (
                            <div className="product-printing-item">
                              <span className="product-printing-label">Supports:</span>
                              <span className="product-printing-value">{productData.printingSettings.resin.supports}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* More Models Section - Full Width */}
          {productData.relatedItems && productData.relatedItems.length > 0 && (
            <div className="product-related product-related-full-width">
              <h2 className="product-related-title">More Models</h2>
              <Carousel>
                {productData.relatedItems.slice(0, 6).map((item) => (
                  <ItemCard key={item.id} {...item} />
                ))}
              </Carousel>
            </div>
          )}
        </div>

        {/* Lower Section - Description, Settings, Discussions */}
        <div className="product-lower">
          {/* Creator Message */}
          {productData.creator?.description && (
            <div className="product-creator-message">
              <p>{productData.creator.description}</p>
            </div>
          )}

          {/* Description */}
          {productData.description && (
            <div className="product-description">
              <p>{productData.description}</p>
            </div>
          )}

          {/* Copyright Info */}
          <div className="product-copyright">
            <p>
              <strong>Copyright and Commercial Use:</strong> This design is under copyright and cannot be sold commercially 
              without joining a membership tier for commercial resale. Digital files are not to be re-sold, shared, or given away.
            </p>
          </div>

          {/* Printing Settings Details */}
          {productData.printingSettings && (
            <div className="product-printing-details">
              <h2 className="product-section-title">3D PRINTING SETTINGS</h2>
              
              {productData.printingSettings.fdm && (
                <div className="product-printing-section">
                  <h3 className="product-printing-subtitle">FDM Settings:</h3>
                  <ul className="product-printing-list">
                    <li>3 walls</li>
                    <li>10-25% infill</li>
                    <li>No supports</li>
                    <li>Try brims if you have adhesion issues.</li>
                    <li>Models tested between 60-100% generally</li>
                  </ul>
                </div>
              )}

              {productData.printingSettings.resin && (
                <div className="product-printing-section">
                  <h3 className="product-printing-subtitle">Resin Settings:</h3>
                  <ul className="product-printing-list">
                    <li>No supports, flat on plate</li>
                    <li>50 um layer thickness</li>
                    <li>Light off delay can be helpful to let resin drip from links.</li>
                    <li>Proper bottom exposure tuning</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Tags (Full List) */}
          {productData.tags && productData.tags.length > 0 && (
            <div className="product-tags-full">
              <h2 className="product-section-title">Tags</h2>
              <div className="product-tags-list">
                {productData.tags.map((tag, index) => (
                  <span key={index} className="product-tag-full">
                    {tag.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Discussions Section */}
          <div className="product-discussions">
            <h2 className="product-section-title">Discussions</h2>
            <div className="product-discussions-content">
              {!productData.isMember ? (
                <p className="product-discussions-message">
                  Become a member to join the conversation
                </p>
              ) : (
                <div className="product-discussions-list">
                  {/* Mock discussion items */}
                  <div className="product-discussion-item">
                    <div className="product-discussion-author">User1</div>
                    <div className="product-discussion-text">
                      Great model! What settings did you use?
                    </div>
                  </div>
                  <div className="product-discussion-item">
                    <div className="product-discussion-author">Creator</div>
                    <div className="product-discussion-text">
                      Thanks! I used the settings listed above. Let me know if you need more details.
                    </div>
                  </div>
                </div>
              )}
              <div className="product-discussions-input">
                <textarea
                  placeholder={productData.isMember ? "Add a comment..." : "Become a member to join the conversation"}
                  disabled={!productData.isMember}
                  className="product-discussions-textarea"
                />
                {productData.isMember && (
                  <button className="product-discussions-submit">Comment</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
