'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import Product from '@/components/Product'
import { useAuth } from '@/components/AuthProvider'
import { showCartToast } from '@/components/ui/Toast'
import {
  getProductById,
  getOrCreateCart,
  addCartItem,
  getLikedProductIds,
  addProductLike,
  removeProductLike,
  getSavedProductIds,
  addProductSave,
  removeProductSave,
  createNotification,
  getProductStats,
  recordProductView,
  getRelatedProducts,
  type ProductDetailRow,
} from '@/lib/supabaseClient'
import { productToHomeItem } from '@/lib/productsForHome'

type ProductAttribute = { id: number; name: string; options: { id: number; label: string }[] }
type ProductVariantOption = { variantId: number; priceOverride: number | null; optionIds: number[] }

type OptionInfo = { id: number; label: string; attribute?: { id: number; name: string; slug: string } | null }

function normOption(ao: unknown): OptionInfo | null {
  if (!ao || typeof ao !== 'object') return null
  const o = ao as Record<string, unknown>
  const rawId = o.id
  const id = typeof rawId === 'number' ? rawId : typeof rawId === 'string' ? parseInt(rawId, 10) : NaN
  if (Number.isNaN(id)) return null
  const label = typeof o.label === 'string' ? o.label : null
  if (label == null) return null
  const attr = o.attribute as { id: number; name: string; slug: string } | undefined
  return { id, label, attribute: attr ?? null }
}

/** Build a map optionId -> OptionInfo from variant data (for fallback when product_attribute_option embed is null). */
function buildOptionLookupFromVariants(p: ProductDetailRow): Map<number, OptionInfo> {
  const map = new Map<number, OptionInfo>()
  const variants = (p as { product_variant?: Array<{
    product_variant_attribute_option?: Array<{ attribute_option?: unknown }>
  }> }).product_variant ?? []
  for (const pv of variants) {
    for (const pvao of pv.product_variant_attribute_option ?? []) {
      const ao = normOption(pvao.attribute_option)
      if (ao) map.set(ao.id, ao)
    }
  }
  return map
}

/** Build attribute list from product_attribute_option; use optionLookup when nested attribute_option is null. */
function buildAttributesFromProductOptions(
  p: ProductDetailRow,
  optionLookup: Map<number, OptionInfo>
): ProductAttribute[] {
  const byAttribute = new Map<number, ProductAttribute>()
  const seenOptions = new Set<number>()
  const list = p.product_attribute_option ?? []
  for (const pao of list) {
    const raw = (pao as { attribute_option?: unknown; attribute_option_id?: number }).attribute_option
    let ao: OptionInfo | null = normOption(raw)
    if (!ao) {
      const rawAoid = (pao as { attribute_option_id?: unknown }).attribute_option_id
      const aoid = typeof rawAoid === 'number' ? rawAoid : typeof rawAoid === 'string' ? parseInt(rawAoid, 10) : NaN
      if (!Number.isNaN(aoid)) ao = optionLookup.get(aoid) ?? null
    }
    const attr = ao?.attribute
    if (!ao || !attr) continue
    let a = byAttribute.get(attr.id)
    if (!a) {
      a = { id: attr.id, name: attr.name, options: [] }
      byAttribute.set(attr.id, a)
    }
    if (!seenOptions.has(ao.id)) {
      seenOptions.add(ao.id)
      a.options.push({ id: ao.id, label: ao.label })
    }
  }
  return Array.from(byAttribute.values())
}

/** Build attribute list from variants (product_variant → product_variant_attribute_option → attribute_option → attribute). */
function buildAttributesFromVariants(p: ProductDetailRow): ProductAttribute[] {
  const byAttribute = new Map<number, ProductAttribute>()
  const seenOptions = new Set<number>()
  const productData = p as {
    product_variant?: Array<{
      status?: string
      product_variant_attribute_option?: Array<{ attribute_option?: unknown }>
      productVariantAttributeOption?: Array<{ attribute_option?: unknown; attributeOption?: unknown }>
    }>
  }
  const variants = (productData.product_variant ?? []).filter((pv) => pv.status !== 'archived')
  for (const pv of variants) {
    const pvaoList = pv.product_variant_attribute_option ?? (pv as { productVariantAttributeOption?: Array<{ attribute_option?: unknown; attributeOption?: unknown }> }).productVariantAttributeOption ?? []
    for (const pvao of pvaoList) {
      const rawOption = (pvao as { attribute_option?: unknown; attributeOption?: unknown }).attribute_option ?? (pvao as { attributeOption?: unknown }).attributeOption
      const ao = normOption(rawOption)
      const attr = ao?.attribute
      if (!ao || !attr) continue
      let a = byAttribute.get(attr.id)
      if (!a) {
        a = { id: attr.id, name: attr.name, options: [] }
        byAttribute.set(attr.id, a)
      }
      if (!seenOptions.has(ao.id)) {
        seenOptions.add(ao.id)
        a.options.push({ id: ao.id, label: ao.label })
      }
    }
  }
  return Array.from(byAttribute.values())
}

/** Attributes to show in UI: prefer attributes derived from variants so selection always matches variant optionIds. */
function buildAttributesFromProduct(p: ProductDetailRow): ProductAttribute[] {
  const fromVariants = buildAttributesFromVariants(p)
  if (fromVariants.length > 0) return fromVariants.slice().sort((a, b) => a.id - b.id)
  const optionLookup = buildOptionLookupFromVariants(p)
  const fromProduct = buildAttributesFromProductOptions(p, optionLookup)
  return fromProduct.slice().sort((a, b) => a.id - b.id)
}

/** Read attribute_option id from product_variant_attribute_option row. Uses attribute_option_id (join table) or nested attribute_option.id (tabla attribute_option). */
function getAttributeOptionIdFromPvao(pvao: {
  attribute_option_id?: number
  attributeOptionId?: number
  attribute_option?: { id?: number } | null
  attributeOption?: { id?: number } | null
}): number | null {
  const fromFk =
    pvao.attribute_option_id ??
    (pvao as { attributeOptionId?: number }).attributeOptionId
  if (fromFk != null) {
    const n = Number(fromFk)
    if (!Number.isNaN(n)) return n
  }
  const nested = pvao.attribute_option ?? (pvao as { attributeOption?: { id?: number } }).attributeOption
  if (nested?.id != null) {
    const n = Number(nested.id)
    if (!Number.isNaN(n)) return n
  }
  return null
}

function buildVariantsFromProduct(p: ProductDetailRow): ProductVariantOption[] {
  const raw = (p as {
    product_variant?: Array<{
      id: number
      price_override: number | null
      status?: string
      product_variant_attribute_option?: Array<{
        attribute_option_id?: number
        attributeOptionId?: number
        attribute_option?: { id?: number } | null
        attributeOption?: { id?: number } | null
      }>
    }>
  }).product_variant ?? []
  return raw
    .filter((pv) => pv.status !== 'archived')
    .map((pv) => {
      const pvaoList =
        pv.product_variant_attribute_option ??
        (pv as { productVariantAttributeOption?: typeof pv.product_variant_attribute_option })
          .productVariantAttributeOption ??
        []
      const optionIds = pvaoList
        .map((pvao) => getAttributeOptionIdFromPvao(pvao))
        .filter((id): id is number => id != null)
      return {
        variantId: pv.id,
        priceOverride: pv.price_override != null ? Number(pv.price_override) : null,
        optionIds,
      }
    })
}

function mapProductToProps(
  p: ProductDetailRow,
  stats: { likes: number; views: number },
  relatedItems: { id: string; title: string; category: string; image?: string; author?: string; price?: string }[]
) {
  const firstCategory = p.product_category?.[0]?.category?.name
  const firstCategorySlug = p.product_category?.[0]?.category?.slug ?? ''
  const designData = p.design_data as {
    imageUrl?: string
    images?: Array<{ url: string; alt?: string }>
    description?: string
  } | null
  const basePrice = Number(p.price)
  const firstVariantPrice = p.product_variant?.[0]?.price_override != null
    ? Number(p.product_variant[0].price_override)
    : basePrice
  const price = firstVariantPrice
  const images = designData?.images?.length
    ? designData.images.map((img) => ({ url: img.url, alt: img.alt ?? p.name }))
    : [{ url: designData?.imageUrl ?? '', alt: p.name }]
  const creatorProfile = p.user_public_profile ?? p.user_account
  const creatorName = creatorProfile?.username ?? 'Unknown'
  return {
    id: String(p.id),
    title: p.name,
    category: firstCategory ?? 'Uncategorized',
    images,
    views: stats.views,
    likes: stats.likes,
    downloads: 0,
    author: creatorName,
    price: `$${price.toFixed(2)}`,
    rating: 0,
    description: designData?.description ?? undefined,
    creator: {
      name: creatorName,
      followers: '—',
      profileUrl: creatorName !== 'Unknown' ? `/profile/${encodeURIComponent(creatorName)}` : undefined,
      avatar: creatorProfile?.avatar_url ?? undefined,
      bio: creatorProfile?.bio ?? undefined,
    },
    creatorUserAccountId: p.user_account_id,
    relatedItems,
    basePrice,
    attributes: buildAttributesFromProduct(p),
    variants: buildVariantsFromProduct(p),
  }
}

export default function ProductPage() {
  const params = useParams()
  const itemId = (params?.id as string) ?? ''
  const { userAccount } = useAuth()

  const [product, setProduct] = useState<ProductDetailRow | null>(null)
  const [stats, setStats] = useState({ likes: 0, views: 0 })
  const [relatedItems, setRelatedItems] = useState<ReturnType<typeof productToHomeItem>[]>([])
  const [loading, setLoading] = useState(true)
  const [addToCartError, setAddToCartError] = useState<string | null>(null)
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    if (!itemId) {
      setLoading(false)
      setProduct(null)
      setStats({ likes: 0, views: 0 })
      setRelatedItems([])
      return
    }
    let cancelled = false
    setLoading(true)
    getProductById(itemId)
      .then((data) => {
        if (!cancelled) setProduct(data ?? null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [itemId])

  useEffect(() => {
    if (!product?.id) return
    const categorySlug = product.product_category?.[0]?.category?.slug ?? ''
    let cancelled = false
    getProductStats(product.id).then((s) => {
      if (!cancelled) setStats(s)
    })
    getRelatedProducts(product.id, categorySlug, 6).then((rows) => {
      if (!cancelled) setRelatedItems(rows.map(productToHomeItem))
    })
    recordProductView(product.id, userAccount?.id)
    return () => { cancelled = true }
  }, [product?.id, product?.product_category, userAccount?.id])

  useEffect(() => {
    if (!userAccount?.id || !product?.id) return
    let cancelled = false
    getLikedProductIds(userAccount.id)
      .then((ids) => {
        if (!cancelled) setIsLiked(ids.includes(product.id))
      })
    return () => { cancelled = true }
  }, [userAccount?.id, product?.id])

  useEffect(() => {
    if (!userAccount?.id || !product?.id) return
    let cancelled = false
    getSavedProductIds(userAccount.id)
      .then((ids) => {
        if (!cancelled) setIsSaved(ids.includes(product.id))
      })
    return () => { cancelled = true }
  }, [userAccount?.id, product?.id])

  const handleLikeToggle = async () => {
    if (!userAccount?.id || !product?.id) return
    const next = !isLiked
    setIsLiked(next)
    const result = next
      ? await addProductLike(userAccount.id, product.id)
      : await removeProductLike(userAccount.id, product.id)
    if (!result.ok) setIsLiked(!next)
    else {
      if (next && product.user_account_id !== userAccount.id) {
        createNotification(
          product.user_account_id,
          'like',
          'Someone liked your product',
          `/item/${product.id}`
        ).catch(() => {})
      }
      window.dispatchEvent(new CustomEvent('collection-updated'))
      window.dispatchEvent(new CustomEvent('notifications-updated'))
      getProductStats(product.id).then(setStats)
    }
  }

  const handleSaveToggle = async () => {
    if (!userAccount?.id || !product?.id) return
    const next = !isSaved
    setIsSaved(next)
    const result = next
      ? await addProductSave(userAccount.id, product.id)
      : await removeProductSave(userAccount.id, product.id)
    if (!result.ok) setIsSaved(!next)
    else window.dispatchEvent(new CustomEvent('collection-updated'))
  }

  return (
    <div className="product-page-wrapper">
      <Navbar />
      
      <Subnavbar />
      
      <main className="product-main-wrapper" role="main">
        {loading && (
          <p className="product-page-loading" aria-live="polite">Loading product…</p>
        )}
        {!loading && !product && (
          <p className="product-page-not-found" role="status">Product not found.</p>
        )}
        {addToCartError && (
          <p className="product-page-error" role="alert">
            {addToCartError}
          </p>
        )}
        {!loading && product && (
          <Product
            {...mapProductToProps(product, stats, relatedItems)}
            isLiked={isLiked}
            onLikeToggle={userAccount?.id ? handleLikeToggle : undefined}
            isSaved={isSaved}
            onSaveToggle={userAccount?.id ? handleSaveToggle : undefined}
            onVariantRequired={(missingAttributeNames) => {
              const message =
                missingAttributeNames.length > 0
                  ? `Please select ${missingAttributeNames.join(' and ')} to add to cart.`
                  : 'Please select a variant to add to cart.'
              setAddToCartError(message)
            }}
            onVariantSelectionChange={() => setAddToCartError(null)}
            onAddToCart={async (variantId, quantity, unitPrice, variantLabel) => {
              setAddToCartError(null)
              if (!userAccount?.id) {
                setAddToCartError('Sign in to add items to your cart.')
                return
              }
              const cart = await getOrCreateCart(userAccount.id)
              if (!cart) {
                setAddToCartError('Could not load your cart.')
                return
              }
              const result = await addCartItem(cart.id, variantId, quantity, unitPrice, variantLabel)
              if (result) {
                window.dispatchEvent(new CustomEvent('cart-updated'))
                showCartToast()
              } else {
                setAddToCartError('Could not add item to cart.')
              }
            }}
          />
        )}
      </main>
      
      <Footer />
    </div>
  )
}
