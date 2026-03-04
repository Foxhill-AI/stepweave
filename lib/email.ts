import { Resend } from 'resend'
import type { OrderWithItemsRow, OrderItemRow, ShippingAddressRow } from './supabaseClient'

const resendApiKey = process.env.RESEND_API_KEY
const resend = resendApiKey ? new Resend(resendApiKey) : null

/** From address. Use onboarding@resend.dev for testing; use your domain when verified in Resend. */
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Orders <onboarding@resend.dev>'

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'USD').toUpperCase(),
  }).format(amount)
}

function estimatedDeliveryFromOrder(order: OrderWithItemsRow): string {
  const from = order.paid_at || order.created_at
  if (!from) return 'Within 3–5 business days'
  const start = new Date(from)
  let count = 0
  const d = new Date(start)
  while (count < 5) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
  }
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatShippingLines(addr: ShippingAddressRow | null): string[] {
  if (!addr) return []
  const lines: string[] = []
  if (addr.line1) lines.push(addr.line1)
  if (addr.line2) lines.push(addr.line2)
  const cityLine = [addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')
  if (cityLine) lines.push(cityLine)
  if (addr.country) lines.push(addr.country)
  return lines
}

function buildOrderConfirmationHtml(params: {
  orderNumber: number
  items: OrderItemRow[]
  total: number
  currency: string
  shippingLines: string[]
  estimatedDelivery: string
  viewOrderUrl: string | null
}): string {
  const {
    orderNumber,
    items,
    total,
    currency,
    shippingLines,
    estimatedDelivery,
    viewOrderUrl,
  } = params

  const rows = items
    .map(
      (item) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(item.product_name)}${item.variant_label ? ` <span style="color:#666;">(${escapeHtml(String(item.variant_label))})</span>` : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(Number(item.unit_price), currency)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(Number(item.subtotal), currency)}</td>
    </tr>`
    )
    .join('')

  const shippingBlock =
    shippingLines.length > 0
      ? `
    <p style="margin:0 0 4px;font-weight:600;">Shipping address</p>
    <p style="margin:0 0 16px;color:#333;line-height:1.5;">${shippingLines.map((l) => escapeHtml(l)).join('<br />')}</p>
  `
      : ''

  const viewOrderBlock = viewOrderUrl
    ? `<p style="margin-top:24px;"><a href="${escapeHtml(viewOrderUrl)}" style="color:#0066cc;font-weight:600;">View your order</a></p>`
    : ''

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
  <h1 style="font-size:1.5rem;margin:0 0 8px;">Thank you for your order</h1>
  <p style="color:#555;margin:0 0 24px;">Your payment was successful. Here are your order details.</p>

  <p style="margin:0 0 8px;"><strong>Order #${orderNumber}</strong></p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <thead>
      <tr style="background:#f5f5f5;">
        <th style="padding:8px 12px;text-align:left;">Item</th>
        <th style="padding:8px 12px;text-align:center;">Qty</th>
        <th style="padding:8px 12px;text-align:right;">Unit price</th>
        <th style="padding:8px 12px;text-align:right;">Subtotal</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <p style="text-align:right;font-size:1.125rem;margin:0 0 24px;"><strong>Total: ${formatCurrency(total, currency)}</strong></p>

  ${shippingBlock}

  <p style="margin:0;font-weight:600;">Estimated delivery</p>
  <p style="margin:0 0 24px;color:#333;">${escapeHtml(estimatedDelivery)}</p>

  ${viewOrderBlock}
</body>
</html>
`.trim()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type SendOrderConfirmationParams = {
  to: string
  order: OrderWithItemsRow
  /** Checkout session ID for the "View order" link (confirmation page). Optional. */
  sessionId?: string | null
}

const defaultOrigin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Send order confirmation email via Resend.
 * No-op if RESEND_API_KEY is not set (e.g. local dev without Resend).
 */
export async function sendOrderConfirmationEmail(
  params: SendOrderConfirmationParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Resend] RESEND_API_KEY not set; skipping order confirmation email to', params.to)
    }
    return { ok: true }
  }

  const { to, order, sessionId } = params
  const items = (order.order_item ?? []) as OrderItemRow[]
  const total = Number(order.total_amount)
  const currency = order.currency || 'usd'
  const shippingLines = formatShippingLines(order.shipping_address ?? null)
  const estimatedDelivery = estimatedDeliveryFromOrder(order)
  const origin = defaultOrigin.replace(/\/$/, '')
  const viewOrderUrl =
    sessionId != null && sessionId !== ''
      ? `${origin}/order/confirmation?session_id=${encodeURIComponent(sessionId)}`
      : `${origin}/profile`

  const html = buildOrderConfirmationHtml({
    orderNumber: order.id,
    items,
    total,
    currency,
    shippingLines,
    estimatedDelivery,
    viewOrderUrl,
  })

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to.trim(),
      subject: `Order confirmation #${order.id}`,
      html,
    })
    if (error) {
      console.error('Resend sendOrderConfirmationEmail:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Resend sendOrderConfirmationEmail exception:', message)
    return { ok: false, error: message }
  }
}

/**
 * Send "Subscription ended" email when a subscription is canceled at period end.
 * No-op if RESEND_API_KEY is not set.
 */
export async function sendSubscriptionEndedEmail(params: {
  to: string
  newTier: 'free' | 'starter'
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Resend] RESEND_API_KEY not set; skipping subscription ended email to', params.to)
    }
    return { ok: true }
  }
  const { to, newTier } = params
  const origin = defaultOrigin.replace(/\/$/, '')
  const reactivateUrl = `${origin}/pricing`
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
  <h1 style="font-size:1.5rem;margin:0 0 8px;">Subscription ended</h1>
  <p style="color:#555;margin:0 0 24px;">Your creator subscription has ended. Your plan is now <strong>${newTier === 'starter' ? 'Starter' : 'Free'}</strong>.</p>
  <p style="margin:0 0 24px;">You can resubscribe anytime to regain access to creator features.</p>
  <p style="margin-top:24px;"><a href="${reactivateUrl}" style="color:#0066cc;font-weight:600;">View plans</a></p>
</body>
</html>`
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to.trim(),
      subject: 'Your subscription has ended',
      html,
    })
    if (error) {
      console.error('Resend sendSubscriptionEndedEmail:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Resend sendSubscriptionEndedEmail exception:', message)
    return { ok: false, error: message }
  }
}
