'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Package, Calendar, DollarSign, MapPin } from 'lucide-react'
import '../styles/OrdersTab.css'

interface OrderItem {
  product_name: string
  variant_label?: string
  price: string
  quantity: number
  subtotal: string
}

export type ShippingAddress = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}

export interface Order {
  id: string
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled'
  total_amount: string
  currency: string
  created_at: string
  paid_at?: string
  shipping_address?: ShippingAddress
  items: OrderItem[]
}

interface OrdersTabProps {
  /** Orders from Supabase; undefined = loading, [] = empty */
  orders?: Order[] | undefined
}

export default function OrdersTab({ orders }: OrdersTabProps) {
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  const orderList = orders ?? []
  const isLoading = orders === undefined

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'paid':
        return 'status-success'
      case 'pending':
        return 'status-warning'
      case 'failed':
      case 'refunded':
      case 'cancelled':
        return 'status-error'
      default:
        return ''
    }
  }

  /** User-friendly label so paid orders read as completed/approved in Order History */
  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'paid':
        return 'Completed'
      case 'pending':
        return 'Pending'
      case 'failed':
        return 'Failed'
      case 'refunded':
        return 'Refunded'
      case 'cancelled':
        return 'Cancelled'
      default: {
        const s = String(status)
        return s.charAt(0).toUpperCase() + s.slice(1)
      }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  /** First few item names for preview in collapsed card (max 2). */
  const getItemsPreview = (order: Order): string => {
    const names = order.items.slice(0, 2).map(
      (i) => `${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ''}`
    )
    if (order.items.length > 2) return names.join(', ') + ` +${order.items.length - 2} more`
    return names.join(', ') || '—'
  }

  const formatShippingAddress = (addr: NonNullable<Order['shipping_address']>): string[] => {
    const lines: string[] = []
    if (addr.line1) lines.push(addr.line1)
    if (addr.line2) lines.push(addr.line2)
    const cityLine = [addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')
    if (cityLine) lines.push(cityLine)
    if (addr.country) lines.push(addr.country)
    return lines
  }

  return (
    <div className="orders-tab">
      <div className="orders-tab-header">
        <h3 className="orders-tab-title">Order History</h3>
        {!isLoading && (
          <span className="orders-tab-count">
            {orderList.length} {orderList.length === 1 ? 'order' : 'orders'}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="orders-tab-loading">
          <p>Loading orders…</p>
        </div>
      ) : orderList.length > 0 ? (
        <div className="orders-list">
          {orderList.map((order) => {
            const isExpanded = expandedOrders.has(order.id)
            return (
              <div key={order.id} className="order-card">
                <div className="order-card-header" onClick={() => toggleOrder(order.id)}>
                  <div className="order-card-main-info">
                    <div className="order-card-id">
                      <Package size={18} />
                      <span>Order #{order.id}</span>
                    </div>
                    <div className={`order-status order-status-${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </div>
                  </div>
                  <div className="order-card-meta">
                    <div className="order-card-amount">
                      <DollarSign size={16} />
                      <span>{order.total_amount} {order.currency}</span>
                    </div>
                    <div className="order-card-date">
                      <Calendar size={16} />
                      <span>{formatDate(order.created_at)}</span>
                    </div>
                    {!isExpanded && order.items.length > 0 && (
                      <div className="order-card-preview" title="Items in this order">
                        {getItemsPreview(order)}
                      </div>
                    )}
                    <button className="order-card-toggle">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="order-card-details">
                    <div className="order-items">
                      <h4 className="order-items-title">Items</h4>
                      {order.items.map((item, index) => (
                        <div key={index} className="order-item">
                          <div className="order-item-info">
                            <span className="order-item-name">
                              {item.product_name}
                              {item.variant_label ? (
                                <span className="order-item-variant"> ({item.variant_label})</span>
                              ) : null}
                            </span>
                            <span className="order-item-quantity">Qty: {item.quantity}</span>
                          </div>
                          <div className="order-item-price">
                            <span>{item.price} {order.currency} × {item.quantity}</span>
                            <span className="order-item-subtotal">{item.subtotal} {order.currency}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {order.shipping_address && formatShippingAddress(order.shipping_address).length > 0 && (
                      <div className="order-shipping">
                        <h4 className="order-items-title">
                          <MapPin size={16} aria-hidden />
                          Shipping address
                        </h4>
                        <address className="order-shipping-address">
                          {formatShippingAddress(order.shipping_address).map((line, i) => (
                            <span key={i}>{line}</span>
                          ))}
                        </address>
                      </div>
                    )}
                    {order.paid_at && (
                      <div className="order-paid-date">
                        Paid on: {formatDate(order.paid_at)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="orders-tab-empty">
          <p>You haven&apos;t placed any orders yet.</p>
        </div>
      )}
    </div>
  )
}
