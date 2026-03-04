'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, Plus, Minus, ShoppingCart } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import {
  getOrCreateCart,
  getCartItems,
  updateCartItemQuantity,
  removeCartItem,
  type CartItemRow,
} from '@/lib/supabaseClient'
import '../styles/CartTab.css'

interface CartItem {
  id: string
  product_id: string
  product_name: string
  product_price: string
  quantity: number
  price_at_added: string
}

function mapCartItemRowToItem(row: CartItemRow): CartItem {
  const product = row.product_variant?.product
  return {
    id: String(row.id),
    product_id: String(product?.id ?? 0),
    product_name: product?.name ?? 'Product',
    product_price: Number(row.unit_price_at_added).toFixed(2),
    quantity: row.quantity,
    price_at_added: Number(row.unit_price_at_added).toFixed(2),
  }
}

export default function CartTab() {
  const { userAccount } = useAuth()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCart = useCallback(async () => {
    if (!userAccount?.id) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const cart = await getOrCreateCart(userAccount.id)
    if (!cart) {
      setItems([])
      setLoading(false)
      return
    }
    const rows = await getCartItems(cart.id)
    setItems(rows.map(mapCartItemRowToItem))
    setLoading(false)
  }, [userAccount?.id])

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return
    const ok = await updateCartItemQuantity(Number(itemId), newQuantity)
    if (ok) setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, quantity: newQuantity } : item)))
  }

  const removeItem = async (itemId: string) => {
    const ok = await removeCartItem(Number(itemId))
    if (ok) setItems((prev) => prev.filter((item) => item.id !== itemId))
  }

  const subtotal = items.reduce((sum, item) =>
    sum + (parseFloat(item.price_at_added) * item.quantity), 0
  )
  const tax = subtotal * 0.1
  const total = subtotal + tax

  if (loading) {
    return (
      <div className="cart-tab">
        <p className="cart-tab-loading" aria-live="polite">Loading cart…</p>
      </div>
    )
  }

  return (
    <div className="cart-tab">
      <div className="cart-tab-header">
        <h3 className="cart-tab-title">Shopping Cart</h3>
        <span className="cart-tab-count">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {items.length > 0 ? (
        <div className="cart-tab-content">
          <div className="cart-items">
            {items.map((item) => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-info">
                  <h4 className="cart-item-name">{item.product_name}</h4>
                  <div className="cart-item-price-info">
                    <span className="cart-item-price">${item.price_at_added}</span>
                    <span className="cart-item-total">
                      ${(parseFloat(item.price_at_added) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="cart-item-actions">
                  <div className="cart-item-quantity">
                    <button
                      className="cart-quantity-btn"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      aria-label="Decrease quantity"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="cart-quantity-value">{item.quantity}</span>
                    <button
                      className="cart-quantity-btn"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      aria-label="Increase quantity"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <button
                    className="cart-remove-btn"
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove item"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <div className="cart-summary-row">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="cart-summary-row">
              <span>Tax</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="cart-summary-row cart-summary-total">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <button className="cart-checkout-btn">
              Proceed to Checkout
            </button>
          </div>
        </div>
      ) : (
        <div className="cart-tab-empty">
          <ShoppingCart size={48} />
          <p>Your cart is empty</p>
        </div>
      )}
    </div>
  )
}
