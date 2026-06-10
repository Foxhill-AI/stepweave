'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Heart, Share2, Bookmark, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, User, Clock, Eye, Star } from 'lucide-react'
import ItemCard from './ItemCard'
import Carousel from './Carousel'
import { useAuth } from '@/components/AuthProvider'
import {
  isFollowing as getIsFollowing, followUser, unfollowUser, createNotification,
  getProductComments, addProductComment, deleteProductComment,
  type ProductCommentRow,
} from '@/lib/supabaseClient'
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
  /** Numeric product id — needed for discussions. */
  productNumericId?: number
  /** Gender context for sizing (e.g. "Men's" or "Women's"), shown next to the Size label. */
  sizeGender?: string
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
  productNumericId,
  sizeGender,
}: ProductProps) {
  const { userAccount } = useAuth()
  const pathname = usePathname()
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false)
  const [localLiked, setLocalLiked] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  // Reviews
  const [comments, setComments] = useState<ProductCommentRow[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [commentRating, setCommentRating] = useState<number>(0)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
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
      if (!error) {
        setIsFollowing(false)
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('following-updated'))
      }
    } else {
      const { error } = await followUser(userAccount.id, creatorUserAccountId)
      if (!error) {
        setIsFollowing(true)
        const msg = `${userAccount.username || 'Someone'} started following you`
        const link = productData.creator?.profileUrl ?? (productData.creator?.name ? `/profile/${encodeURIComponent(productData.creator.name)}` : null)
        createNotification(creatorUserAccountId, 'follow', msg, link).catch(() => {})
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('notifications-updated'))
          window.dispatchEvent(new CustomEvent('following-updated'))
        }
      }
    }
    setFollowLoading(false)
  }
  useEffect(() => {
    if (!productNumericId) return
    let cancelled = false
    getProductComments(productNumericId).then((rows) => {
      if (!cancelled) setComments(rows)
    })
    return () => { cancelled = true }
  }, [productNumericId])

  const handleCommentSubmit = async () => {
    const body = commentBody.trim()
    if (!body || !userAccount?.id || !productNumericId) return
    if (commentRating === 0) {
      setCommentError('Please select a star rating before submitting.')
      return
    }
    setCommentSubmitting(true)
    setCommentError(null)
    const newId = await addProductComment(productNumericId, userAccount.id, body, null, commentRating)
    if (newId) {
      setCommentBody('')
      setCommentRating(0)
      setHoverRating(0)
      // Re-fetch to get author info attached
      getProductComments(productNumericId).then(setComments)
    } else {
      setCommentError('Could not post review. Please try again.')
    }
    setCommentSubmitting(false)
  }

  const handleCommentDelete = async (commentId: number) => {
    if (!productNumericId) return
    const ok = await deleteProductComment(commentId)
    if (ok) setComments((prev) => prev.filter((c) => c.id !== commentId))
  }

  /** One option per attribute (attributeId -> optionId) for variant selection */
  const [selectedOptionByAttribute, setSelectedOptionByAttribute] = useState<Record<number, number>>({})
  /** Flashes an inline error when user tries to add to cart without selecting a size. */
  const [sizeError, setSizeError] = useState(false)
  /** String state so manual typing (e.g. clearing the field, entering "12") works; clamp on blur / submit. */
  const [quantityInput, setQuantityInput] = useState('1')
  const [shareFallbackOpen, setShareFallbackOpen] = useState(false)
  const [productPageUrl, setProductPageUrl] = useState('')
  const [copyLinkDone, setCopyLinkDone] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setProductPageUrl(`${window.location.origin}${pathname}`)
  }, [pathname])

  useEffect(() => {
    setQuantityInput('1')
  }, [id])

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

  const sharePageTitle = productData.title || `Product ${id}`
  const sharePageText = `Check out ${sharePageTitle}`

  const getShareUrl = useCallback(
    () => productPageUrl || (typeof window !== 'undefined' ? window.location.href : ''),
    [productPageUrl]
  )

  const openShareFallback = () => setShareFallbackOpen(true)
  const closeShareFallback = () => {
    setShareFallbackOpen(false)
    setCopyLinkDone(false)
  }

  const handleShareClick = async () => {
    const url = getShareUrl()
    if (!url) {
      openShareFallback()
      return
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        // Pass url only via `url` — including it in `text` too makes many targets show the link twice.
        await navigator.share({
          title: sharePageTitle,
          text: sharePageText,
          url,
        })
        return
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }
    openShareFallback()
  }

  const handleCopyProductLink = async () => {
    const url = getShareUrl()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopyLinkDone(true)
      window.setTimeout(() => setCopyLinkDone(false), 2500)
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopyLinkDone(true)
        window.setTimeout(() => setCopyLinkDone(false), 2500)
      } catch {
        /* ignore */
      }
    }
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

  const shareUrlForModal = getShareUrl()

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
                  aria-label={isSaved ? 'Remove from My Saves' : 'Save to My Saves'}
                >
                  <Bookmark size={20} fill={isSaved ? 'currentColor' : 'none'} />
                  <span>{isSaved ? 'Saved' : 'Save'}</span>
                </button>
              )}
              <button
                type="button"
                className="product-action-button"
                aria-label="Share"
                aria-expanded={shareFallbackOpen}
                aria-haspopup="dialog"
                onClick={() => void handleShareClick()}
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
                  const isSize = attr.name.toLowerCase() === 'size'
                  return (
                    <div key={attr.id} className="product-attribute-group">
                      <div className="product-attribute-label-row">
                        <span className="product-attribute-label">{attr.name}</span>
                        {isSize && sizeGender && (
                          <span className="product-attribute-gender-note">{sizeGender}&apos;s sizing</span>
                        )}
                      </div>
                      <div className="product-attribute-options">
                        {(isSize
                          ? [...attr.options].sort((a, b) => {
                              const n = (s: string) => parseFloat(s.replace(/[^\d.]/g, ''))
                              const na = n(a.label), nb = n(b.label)
                              if (!isNaN(na) && !isNaN(nb)) return na - nb
                              return a.label.localeCompare(b.label)
                            })
                          : attr.options
                        ).map((opt) => {
                          const swatchHex = isColor ? labelToColorHex(opt.label) : null
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              className={`product-attribute-option ${selectedOptionByAttribute[attr.id] === opt.id ? 'selected' : ''} ${isColor ? 'product-attribute-option-color' : ''}`}
                              onClick={() => {
                                setSelectedOptionByAttribute((prev) => ({ ...prev, [attr.id]: opt.id }))
                                setSizeError(false)
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
                      {isSize && (
                        <p className="product-attribute-size-tip">These shoes run small — we recommend ordering one size up.</p>
                      )}
                      {isSize && sizeError && (
                        <p className="product-attribute-size-error" role="alert">Please select a size.</p>
                      )}
                    </div>
                  )
                })}
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
                    step={1}
                    inputMode="numeric"
                    value={quantityInput}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '') {
                        setQuantityInput('')
                        return
                      }
                      if (!/^\d+$/.test(v)) return
                      setQuantityInput(v)
                    }}
                    onBlur={() => {
                      const n = parseInt(quantityInput, 10)
                      if (!Number.isFinite(n) || n < 1) setQuantityInput('1')
                      else setQuantityInput(String(n))
                    }}
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
                      setSizeError(true)
                      onVariantRequired?.(missingAttributeNames)
                      return
                    }
                    if (variantIdForCart != null) {
                      const qty = Math.max(1, parseInt(quantityInput, 10) || 1)
                      onAddToCart?.(variantIdForCart, qty, unitPriceForCart, selectedVariantLabel || undefined)
                    }
                  }}
                >
                  Add to cart
                </button>
              </div>
            )}

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

          {/* Reviews Section */}
          <div className="product-discussions">
            <h2 className="product-section-title">Reviews</h2>
            <div className="product-discussions-content">
              {comments.length > 0 ? (
                <div className="product-discussions-list">
                  {comments.map((c) => (
                    <div key={c.id} className="product-discussion-item">
                      <div className="product-review-header">
                        <span className="product-discussion-author">
                          {c.author_username ?? 'User'}
                        </span>
                        {c.rating != null && c.rating > 0 && (
                          <span className="product-review-stars" aria-label={`${c.rating} out of 5 stars`}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                size={14}
                                className={s <= c.rating! ? 'star-full' : 'star-empty'}
                                fill={s <= c.rating! ? 'currentColor' : 'none'}
                              />
                            ))}
                          </span>
                        )}
                      </div>
                      <div className="product-discussion-text">{c.body}</div>
                      {userAccount?.id === c.user_account_id && (
                        <button
                          type="button"
                          className="product-discussion-delete"
                          onClick={() => handleCommentDelete(c.id)}
                          aria-label="Delete review"
                        >
                          ✕
                        </button>
                      )}
                      {c.replies && c.replies.length > 0 && (
                        <div className="product-discussion-replies">
                          {c.replies.map((r) => (
                            <div key={r.id} className="product-discussion-item product-discussion-item--reply">
                              <div className="product-review-header">
                                <span className="product-discussion-author">{r.author_username ?? 'User'}</span>
                              </div>
                              <div className="product-discussion-text">{r.body}</div>
                              {userAccount?.id === r.user_account_id && (
                                <button
                                  type="button"
                                  className="product-discussion-delete"
                                  onClick={() => handleCommentDelete(r.id)}
                                  aria-label="Delete reply"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="product-discussions-message">
                  No reviews yet. Be the first to leave a review!
                </p>
              )}

              {userAccount ? (
                <div className="product-discussions-input">
                  <div className="product-review-rating-input">
                    <span className="product-review-rating-label">Your rating:</span>
                    <div className="product-review-stars-input" role="radiogroup" aria-label="Rating">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="product-review-star-btn"
                          onClick={() => setCommentRating(s)}
                          onMouseEnter={() => setHoverRating(s)}
                          onMouseLeave={() => setHoverRating(0)}
                          aria-label={`${s} star${s > 1 ? 's' : ''}`}
                          aria-pressed={commentRating === s}
                          disabled={commentSubmitting}
                        >
                          <Star
                            size={22}
                            className={s <= (hoverRating || commentRating) ? 'star-full' : 'star-empty'}
                            fill={s <= (hoverRating || commentRating) ? 'currentColor' : 'none'}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    placeholder="Share your experience with this product…"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    className="product-discussions-textarea"
                    maxLength={2000}
                    disabled={commentSubmitting}
                  />
                  {commentError && (
                    <p className="product-discussions-error" role="alert">{commentError}</p>
                  )}
                  <button
                    type="button"
                    className="product-discussions-submit"
                    onClick={handleCommentSubmit}
                    disabled={!commentBody.trim() || commentSubmitting}
                  >
                    {commentSubmitting ? 'Posting…' : 'Submit Review'}
                  </button>
                </div>
              ) : (
                <p className="product-discussions-message">
                  <a href="/sign-in">Sign in</a> to leave a review.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {shareFallbackOpen && (
        <>
          <button
            type="button"
            className="product-share-backdrop"
            aria-label="Close share menu"
            onClick={closeShareFallback}
          />
          <div
            className="product-share-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-share-title"
          >
            <div className="product-share-sheet-header">
              <h2 id="product-share-title" className="product-share-sheet-title">
                Share
              </h2>
              <button
                type="button"
                className="product-share-sheet-close"
                onClick={closeShareFallback}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="product-share-sheet-hint">
              Your device may also offer more apps if sharing isn’t available above.
            </p>
            <div className="product-share-sheet-actions">
              <button
                type="button"
                className="product-share-action"
                onClick={() => void handleCopyProductLink()}
              >
                {copyLinkDone ? 'Link copied' : 'Copy link'}
              </button>
              <a
                className="product-share-action"
                href={
                  shareUrlForModal
                    ? `https://wa.me/?text=${encodeURIComponent(`${sharePageText} ${shareUrlForModal}`)}`
                    : '#'
                }
                target="_blank"
                rel="noopener noreferrer"
                onClick={!shareUrlForModal ? (e) => e.preventDefault() : undefined}
              >
                WhatsApp
              </a>
              <a
                className="product-share-action"
                href={
                  shareUrlForModal
                    ? `sms:?body=${encodeURIComponent(`${sharePageText} ${shareUrlForModal}`)}`
                    : '#'
                }
                onClick={!shareUrlForModal ? (e) => e.preventDefault() : undefined}
              >
                Messages / SMS
              </a>
              <a
                className="product-share-action"
                href={
                  shareUrlForModal
                    ? `mailto:?subject=${encodeURIComponent(sharePageTitle)}&body=${encodeURIComponent(`${sharePageText}\n\n${shareUrlForModal}`)}`
                    : '#'
                }
                onClick={!shareUrlForModal ? (e) => e.preventDefault() : undefined}
              >
                Email
              </a>
              <a
                className="product-share-action"
                href={
                  shareUrlForModal
                    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrlForModal)}`
                    : '#'
                }
                target="_blank"
                rel="noopener noreferrer"
                onClick={!shareUrlForModal ? (e) => e.preventDefault() : undefined}
              >
                Facebook
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
