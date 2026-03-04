'use client'

import { useState, useEffect, useCallback } from 'react'
import { Minus, Plus, Trash2, Download, Package, ShoppingBag, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import Modal from './ui/Modal'
import { useAuth } from '@/components/AuthProvider'
import {
  getOrCreateCart,
  getCartItems,
  updateCartItemQuantity,
  removeCartItem,
  type CartItemRow,
} from '@/lib/supabaseClient'
import '../styles/CartModal.css'

function mapCartItemRowToItem(row: CartItemRow): CartItem {
  const product = row.product_variant?.product
  const designData = product?.design_data as { imageUrl?: string } | null
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
    title: product?.name ?? 'Product',
    author: product?.user_account?.username ?? 'Unknown',
    image: designData?.imageUrl ?? '',
    price: Number(row.unit_price_at_added),
    quantity: row.quantity,
    type: 'print',
    delivery: 'Ships in 3-5 business days',
    variantLabel,
  }
}

interface CartItem {
  id: string
  title: string
  author: string
  image: string
  price: number
  quantity: number
  type: 'digital' | 'print'
  delivery: string
  variantLabel?: string
}

interface CartModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CartModal({ isOpen, onClose }: CartModalProps) {
  const { userAccount } = useAuth()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [cartId, setCartId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const fetchCart = useCallback(async () => {
    if (!userAccount?.id || !isOpen) return
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
  }, [userAccount?.id, isOpen])

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )
  const shipping = cartItems.some((item) => item.type === 'print') ? 5.99 : 0
  const taxRate = 0.08
  const taxes = subtotal * taxRate

  const handleCheckout = useCallback(async () => {
    if (cartId == null || cartItems.length === 0) return
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId, shipping, taxes }),
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
    if (isOpen && userAccount?.id) fetchCart()
    else if (!userAccount?.id) setCartItems([])
  }, [isOpen, userAccount?.id, fetchCart])

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="cart-modal">
      {cartItems.length === 0 ? (
        <EmptyCart onClose={onClose} />
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
    </Modal>
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

  return (
    <div className="cart-item-card">
      <div className="cart-item-image-wrapper">
        {item.image ? (
          <img src={item.image} alt={item.title} className="cart-item-image" />
        ) : (
          <div className="cart-item-image-placeholder">
            <span>{item.title.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <span className={`cart-item-badge ${item.type === 'digital' ? 'badge-digital' : 'badge-print'}`}>
          {item.type === 'digital' ? 'Digital' : 'Print'}
        </span>
      </div>

      <div className="cart-item-details">
        <h3 className="cart-item-title">{item.title}</h3>
        {item.variantLabel != null && item.variantLabel !== '' && (
          <p className="cart-item-variant" aria-label="Variant">Variant: {item.variantLabel}</p>
        )}
        <p className="cart-item-author">by {item.author}</p>
        <div className="cart-item-delivery">
          {item.type === 'digital' ? (
            <Download size={14} aria-hidden="true" />
          ) : (
            <Package size={14} aria-hidden="true" />
          )}
          <span>{item.delivery}</span>
        </div>

        <div className="cart-item-controls">
          <div className="quantity-selector">
            <span className="quantity-label">Quantity:</span>
            <button
              className="quantity-button"
              onClick={() => onUpdateQuantity(item.id, -1)}
              aria-label="Decrease quantity"
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <span className="quantity-value">{item.quantity}</span>
            <button
              className="quantity-button"
              onClick={() => onUpdateQuantity(item.id, 1)}
              aria-label="Increase quantity"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>

          <button
            className="remove-button"
            onClick={() => onRemove(item.id)}
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

      {shipping > 0 && (
        <div className="summary-line">
          <span>Shipping (standard)</span>
          <span>${shipping.toFixed(2)}</span>
        </div>
      )}

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

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="empty-cart">
      <div className="empty-cart-header">
        <h2 className="cart-title">Cart</h2>
      </div>

      <div className="empty-cart-banner">
        <p>Your cart is empty</p>
      </div>

      <div className="empty-cart-content">
        <div className="empty-cart-icon">
          <ShoppingBag size={120} aria-hidden="true" />
        </div>

        <div className="empty-cart-actions">
          <button className="empty-cart-button">
            <Package size={20} aria-hidden="true" />
            <span>Shop for Prints</span>
          </button>
          <button className="empty-cart-button">
            <Download size={20} aria-hidden="true" />
            <span>Shop for Model Downloads</span>
          </button>
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
  )
}
