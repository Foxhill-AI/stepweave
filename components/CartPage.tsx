'use client'

import { useState, useEffect, useCallback } from 'react'
import { Minus, Plus, Trash2, Package, ShoppingBag, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import {
  getOrCreateCart,
  getCartItems,
  updateCartItemQuantity,
  removeCartItem,
  type CartItemRow,
} from '@/lib/supabaseClient'
import ProductImage from './ProductImage'
import { getDesignDraftByCartItemIdForCheckout } from '@/lib/cartDesignDraftMap'
import '../styles/CartPage.css'

function mapCartItemRowToItem(row: CartItemRow): CartItem {
  const product = row.product_variant?.product
  const designData = product?.design_data as { imageUrl?: string; source?: string } | null
  const attrLabels = (row.product_variant?.product_variant_attribute_option ?? [])
    .map((pva) => pva.attribute_option?.label)
    .filter(Boolean) as string[]
  const variantLabel =
    (row.variant_label != null && String(row.variant_label).trim() !== '')
      ? String(row.variant_label).trim()
      : attrLabels.length > 0
        ? attrLabels.join(' / ')
        : ''
  return {
    id: String(row.id),
    productId: product?.id != null ? (product.id as number) : undefined,
    designData: designData ?? undefined,
    title: product?.name ?? 'Product',
    author: product?.user_account?.username ?? 'Unknown',
    image: designData?.imageUrl ?? '',
    price: Number(row.unit_price_at_added),
    quantity: row.quantity,
    delivery: 'Made to order · allow 3–4 weeks for delivery',
    variantLabel,
  }
}

interface CartItem {
  id: string
  productId?: number
  designData?: { imageUrl?: string; source?: string } | null
  title: string
  author: string
  image: string
  price: number
  quantity: number
  delivery: string
  variantLabel?: string
}

export default function CartPage() {
  const { userAccount, loading: authLoading } = useAuth()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [cartId, setCartId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const fetchCart = useCallback(async () => {
    if (!userAccount?.id) {
      setCartItems([])
      setCartId(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const cart = await getOrCreateCart(userAccount.id)
    if (!cart) {
      setCartItems([])
      setCartId(null)
      setLoading(false)
      return
    }
    setCartId(cart.id)
    const rows = await getCartItems(cart.id)
    setCartItems(rows.map(mapCartItemRowToItem))
    setLoading(false)
  }, [userAccount?.id])

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )
  // Shipping is included in the product price (fulfilled via Printful; no separate shipping charge).
  const shipping = 0
  const taxRate = 0.08
  const taxes = subtotal * taxRate

  const handleCheckout = useCallback(async () => {
    if (cartId == null || cartItems.length === 0) return
    setCheckoutLoading(true)
    try {
      const designDraftByCartItemId = getDesignDraftByCartItemIdForCheckout(null)
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId,
          shipping,
          taxes,
          ...(Object.keys(designDraftByCartItemId).length > 0
            ? { designDraftByCartItemId }
            : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error ?? 'Checkout failed')
        setCheckoutLoading(false)
        return
      }
      if (data.url) window.location.href = data.url
      else setCheckoutLoading(false)
    } catch {
      alert('Checkout failed')
      setCheckoutLoading(false)
    }
  }, [cartId, cartItems.length, shipping, taxes])

  useEffect(() => {
    if (!authLoading) fetchCart()
  }, [authLoading, fetchCart])

  const updateQuantity = async (id: string, change: number) => {
    const item = cartItems.find((i) => i.id === id)
    if (!item) return
    const newQty = Math.max(1, item.quantity + change)
    const ok = await updateCartItemQuantity(Number(id), newQty)
    if (ok) setCartItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: newQty } : i)))
  }

  const removeItem = async (id: string) => {
    const ok = await removeCartItem(Number(id))
    if (ok) setCartItems((prev) => prev.filter((i) => i.id !== id))
  }

  const total = subtotal + shipping + taxes

  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  if (authLoading || loading) {
    return (
      <div className="cart-page">
        <p className="cart-loading" aria-live="polite">Loading cart…</p>
      </div>
    )
  }

  return (
    <div className="cart-page">
      {cartItems.length === 0 ? (
        <EmptyCart />
      ) : (
        <div className="cart-content">
          <div className="cart-header">
            <h2 className="cart-title">Shopping Cart</h2>
            <p className="cart-subtitle">Review your items and checkout when ready</p>
            <span className="cart-badge-header">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
          </div>

          <div className="cart-layout">
            <div className="cart-items-section">
              {cartItems.map((item) => (
                <CartItemCard
                  key={item.id}
                  item={item}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                />
              ))}
            </div>

            <div className="cart-summary-section">
              <OrderSummary
                subtotal={subtotal}
                shipping={shipping}
                taxes={taxes}
                total={total}
                cartId={cartId}
                checkoutLoading={checkoutLoading}
                onCheckout={handleCheckout}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CartItemCard({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartItem
  onUpdateQuantity: (id: string, change: number) => void
  onRemove: (id: string) => void
}) {
  const itemTotal = item.price * item.quantity

  const cardContent = (
    <>
      <div className="cart-item-image-wrapper">
        {item.productId != null ? (
          <ProductImage
            productId={item.productId}
            designData={item.designData ?? null}
            alt={item.title}
            className="cart-item-image"
            fallback={
              <div className="cart-item-image-placeholder">
                <span>{item.title.charAt(0).toUpperCase()}</span>
              </div>
            }
          />
        ) : item.image ? (
          <img src={item.image} alt={item.title} className="cart-item-image" />
        ) : (
          <div className="cart-item-image-placeholder">
            <span>{item.title.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <span className="cart-item-badge badge-print">Physical</span>
      </div>

      <div className="cart-item-details">
        <h3 className="cart-item-title">{item.title}</h3>
        {item.variantLabel && (
          <p className="cart-item-variant" aria-label="Variant">Variant: {item.variantLabel}</p>
        )}
        <p className="cart-item-author">by {item.author}</p>
        <div className="cart-item-delivery">
          <Package size={14} aria-hidden="true" />
          <span>{item.delivery}</span>
        </div>

        <div className="cart-item-controls" onClick={(e) => e.preventDefault()}>
          <div className="quantity-selector">
            <span className="quantity-label">Quantity:</span>
            <button
              className="quantity-button"
              onClick={(e) => { e.preventDefault(); onUpdateQuantity(item.id, -1) }}
              aria-label="Decrease quantity"
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <span className="quantity-value">{item.quantity}</span>
            <button
              className="quantity-button"
              onClick={(e) => { e.preventDefault(); onUpdateQuantity(item.id, 1) }}
              aria-label="Increase quantity"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>

          <button
            className="remove-button"
            onClick={(e) => { e.preventDefault(); onRemove(item.id) }}
            aria-label="Remove item"
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="cart-item-total">
          <span className="item-total-label">Item total</span>
          <span className="item-total-price">${itemTotal.toFixed(2)}</span>
        </div>
      </div>
    </>
  )

  return item.productId != null ? (
    <Link href={`/item/${item.productId}`} className="cart-item-card">
      {cardContent}
    </Link>
  ) : (
    <div className="cart-item-card">
      {cardContent}
    </div>
  )
}

function OrderSummary({
  subtotal,
  shipping,
  taxes,
  total,
  cartId,
  checkoutLoading,
  onCheckout,
}: {
  subtotal: number
  shipping: number
  taxes: number
  total: number
  cartId?: number | null
  checkoutLoading?: boolean
  onCheckout?: () => void
}) {
  const canCheckout = cartId != null && !checkoutLoading
  return (
    <div className="order-summary">
      <h3 className="summary-title">Order Summary</h3>

      <div className="summary-line">
        <span>Subtotal</span>
        <span>${subtotal.toFixed(2)}</span>
      </div>

      <div className="summary-line">
        <span>Shipping</span>
        <span style={{ color: '#16a34a', fontWeight: 600 }}>Free</span>
      </div>

      <div className="summary-line">
        <span>Taxes & fees</span>
        <span>${taxes.toFixed(2)}</span>
      </div>

      <div className="summary-divider"></div>

      <div className="summary-total">
        <span>Total</span>
        <span>${total.toFixed(2)}</span>
      </div>

      <button
        type="button"
        className="checkout-button"
        disabled={!canCheckout}
        onClick={onCheckout}
      >
        {checkoutLoading ? 'Redirecting…' : 'Proceed to Checkout'}
      </button>

      <Link href="/" className="continue-shopping">
        <ArrowLeft size={16} aria-hidden="true" />
        <span>Continue Shopping</span>
      </Link>

      <div className="secure-checkout">
        <div className="secure-icon">✓</div>
        <div>
          <strong>Secure Checkout</strong>
          <p>Your payment information is encrypted and secure</p>
        </div>
      </div>
    </div>
  )
}

function EmptyCart() {
  return (
    <div className="empty-cart-page">
      <div className="cart-header">
        <h2 className="cart-title">Cart</h2>
      </div>

      <div className="empty-cart-layout">
        <div className="empty-cart-content">
          <div className="empty-cart-banner">
            <p>Your cart is empty</p>
          </div>

          <div className="empty-cart-center">
            <div className="empty-cart-icon">
              <ShoppingBag size={140} aria-hidden="true" />
            </div>

            <div className="empty-cart-actions">
              <Link href="/marketplace" className="empty-cart-button">
                <Package size={18} aria-hidden="true" />
                <span>Shop Shoes</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="empty-cart-summary">
          <button className="checkout-button disabled" disabled>
            Begin checkout
          </button>
          <div className="summary-line">
            <span>Subtotal</span>
            <span>$0.00</span>
          </div>
          <div className="summary-line">
            <span>Taxes & fees</span>
            <span>$0.00</span>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <span>$0.00</span>
          </div>
        </div>
      </div>
    </div>
  )
}
