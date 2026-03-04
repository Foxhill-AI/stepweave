'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Package, CheckCircle, ArrowRight, UserPlus, MapPin, Truck } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import { useAuth } from '@/components/AuthProvider'
import { type OrderWithItemsRow, type OrderItemRow } from '@/lib/supabaseClient'
import '@/styles/OrderConfirmation.css'

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase() || 'USD',
  }).format(amount)
}

/** Estimated delivery: 3–5 business days from paid_at or created_at. */
function getEstimatedDeliveryDate(order: OrderWithItemsRow): string {
  const from = order.paid_at || order.created_at
  if (!from) return 'Within 3–5 business days'
  const start = new Date(from)
  const days = 5
  let count = 0
  const d = new Date(start)
  while (count < days) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShippingAddress(address: NonNullable<OrderWithItemsRow['shipping_address']>): string[] {
  const lines: string[] = []
  if (address.line1) lines.push(address.line1)
  if (address.line2) lines.push(address.line2)
  const cityLine = [address.city, address.state, address.postal_code].filter(Boolean).join(', ')
  if (cityLine) lines.push(cityLine)
  if (address.country) lines.push(address.country)
  return lines
}

function OrderConfirmationContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const { userAccount } = useAuth()
  const [order, setOrder] = useState<OrderWithItemsRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setError('No checkout session found.')
      setLoading(false)
      return
    }
    let cancelled = false
    fetch(`/api/order/confirmation?session_id=${encodeURIComponent(sessionId)}`, { credentials: 'include' })
      .then(async (res) => {
        const data = res.ok ? await res.json() : null
        if (!cancelled) {
          if (res.ok && data) {
            setOrder(data as OrderWithItemsRow)
          } else {
            const body = res.ok ? null : await res.json().catch(() => ({}))
            setError((body?.error as string) ?? 'Order not found or session expired.')
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load order details.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [sessionId])

  if (loading) {
    return (
      <main className="order-confirmation-main">
        <div className="order-confirmation-container">
          <p className="order-confirmation-loading" aria-live="polite">
            Loading your order…
          </p>
        </div>
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="order-confirmation-main">
        <div className="order-confirmation-container">
          <div className="order-confirmation-error">
            <p>{error ?? 'Order not found.'}</p>
            <Link href="/cart" className="order-confirmation-link">
              Back to cart
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const items = (order.order_item ?? []) as OrderItemRow[]
  const total = Number(order.total_amount)

  return (
    <main className="order-confirmation-main">
      <div className="order-confirmation-container">
        <div className="order-confirmation-success">
          <div className="order-confirmation-header">
            <CheckCircle size={48} className="order-confirmation-icon" aria-hidden />
            <h1 className="order-confirmation-title">Thank you for your order</h1>
            <p className="order-confirmation-subtitle">
              Your payment was successful. Order details below.
            </p>
          </div>

          <div className="order-confirmation-card">
            <div className="order-confirmation-order-id">
              <Package size={20} aria-hidden />
              <span>Order #{order.id}</span>
            </div>
            <p className="order-confirmation-date">
              {formatDate(order.created_at)}
            </p>

            <div className="order-confirmation-items">
              <h2 className="order-confirmation-items-title">Items</h2>
              <ul className="order-confirmation-items-list">
                {items.map((item) => (
                  <li key={item.id} className="order-confirmation-item">
                    <div className="order-confirmation-item-info">
                      <span className="order-confirmation-item-name">
                        {item.product_name}
                        {item.variant_label ? (
                          <span className="order-confirmation-item-variant">
                            {' '}({item.variant_label})
                          </span>
                        ) : null}
                      </span>
                      <span className="order-confirmation-item-meta">
                        {item.quantity} × {formatCurrency(Number(item.unit_price), order.currency)}
                      </span>
                    </div>
                    <span className="order-confirmation-item-subtotal">
                      {formatCurrency(Number(item.subtotal), order.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="order-confirmation-total">
              <span>Total paid</span>
              <strong>{formatCurrency(total, order.currency)}</strong>
            </div>

            {order.shipping_address && formatShippingAddress(order.shipping_address).length > 0 && (
              <div className="order-confirmation-shipping">
                <h2 className="order-confirmation-items-title">
                  <MapPin size={18} aria-hidden />
                  Shipping address
                </h2>
                <address className="order-confirmation-address">
                  {formatShippingAddress(order.shipping_address).map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
                </address>
              </div>
            )}

            <div className="order-confirmation-delivery">
              <Truck size={18} aria-hidden />
              <span>
                <strong>Estimated delivery:</strong>{' '}
                {getEstimatedDeliveryDate(order)}
              </span>
            </div>
          </div>

          <div className="order-confirmation-actions">
            {userAccount ? (
              <Link
                href="/profile"
                className="order-confirmation-btn order-confirmation-btn-primary"
              >
                View order history
                <ArrowRight size={18} aria-hidden />
              </Link>
            ) : (
              <Link
                href="/?openAuth=signup"
                className="order-confirmation-btn order-confirmation-btn-primary"
              >
                Create an account to track your orders
                <UserPlus size={18} aria-hidden />
              </Link>
            )}
            <Link href="/" className="order-confirmation-btn order-confirmation-btn-secondary">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function OrderConfirmationPage() {
  return (
    <div className="order-confirmation-wrapper">
      <Navbar />
      <Subnavbar />
      <Suspense
        fallback={
          <main className="order-confirmation-main">
            <div className="order-confirmation-container">
              <p className="order-confirmation-loading">Loading…</p>
            </div>
          </main>
        }
      >
        <OrderConfirmationContent />
      </Suspense>
      <Footer />
    </div>
  )
}
