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
 * Send a generic alert to all admin emails (ADMIN_ALERT_EMAIL, comma-separated).
 * No-op if RESEND_API_KEY or ADMIN_ALERT_EMAIL is not set.
 */
export async function sendAdminAlert(params: {
  subject: string
  title: string
  body: string
  /** Optional extra detail block rendered as <pre> */
  detail?: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: true }

  const adminEmailRaw = process.env.ADMIN_ALERT_EMAIL?.trim()
  if (!adminEmailRaw) return { ok: true }
  const adminEmail = adminEmailRaw.split(',').map((e) => e.trim()).filter(Boolean)
  if (adminEmail.length === 0) return { ok: true }

  const { subject, title, body, detail } = params

  const detailBlock = detail
    ? `<pre style="background:#f5f5f5;padding:12px;border-radius:4px;font-size:0.85rem;overflow-x:auto;margin-top:16px;">${escapeHtml(detail)}</pre>`
    : ''

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
  <h1 style="font-size:1.25rem;margin:0 0 12px;color:#cc0000;">${escapeHtml(title)}</h1>
  <p style="margin:0 0 8px;color:#333;">${body}</p>
  ${detailBlock}
</body>
</html>`.trim()

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `[Step Weave] ${subject}`,
      html,
    })
    if (error) {
      console.error('Resend sendAdminAlert:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Resend sendAdminAlert exception:', message)
    return { ok: false, error: message }
  }
}

/**
 * Send a weekly admin summary report.
 * No-op if RESEND_API_KEY or ADMIN_ALERT_EMAIL is not set.
 */
export async function sendWeeklyAdminReport(params: {
  weekLabel: string
  newUsers: number
  newProducts: number
  newOrders: number
  totalRevenue: number
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: true }
  const adminEmailRaw = process.env.ADMIN_ALERT_EMAIL?.trim()
  if (!adminEmailRaw) return { ok: true }
  const adminEmail = adminEmailRaw.split(',').map((e) => e.trim()).filter(Boolean)
  if (adminEmail.length === 0) return { ok: true }

  const { weekLabel, newUsers, newProducts, newOrders, totalRevenue } = params
  const formattedRevenue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(totalRevenue)

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
  <h1 style="font-size:1.25rem;margin:0 0 4px;">Step Weave — Weekly Report</h1>
  <p style="color:#888;font-size:0.875rem;margin:0 0 24px;">${escapeHtml(weekLabel)}</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="padding:12px 0;color:#555;border-bottom:1px solid #eee;">New signups</td>
      <td style="padding:12px 0;text-align:right;font-weight:700;border-bottom:1px solid #eee;">${newUsers.toLocaleString()}</td>
    </tr>
    <tr>
      <td style="padding:12px 0;color:#555;border-bottom:1px solid #eee;">Products published</td>
      <td style="padding:12px 0;text-align:right;font-weight:700;border-bottom:1px solid #eee;">${newProducts.toLocaleString()}</td>
    </tr>
    <tr>
      <td style="padding:12px 0;color:#555;border-bottom:1px solid #eee;">Orders placed</td>
      <td style="padding:12px 0;text-align:right;font-weight:700;border-bottom:1px solid #eee;">${newOrders.toLocaleString()}</td>
    </tr>
    <tr>
      <td style="padding:12px 0;color:#555;font-weight:600;">Revenue generated</td>
      <td style="padding:12px 0;text-align:right;font-weight:700;font-size:1.125rem;color:#0066cc;">${formattedRevenue}</td>
    </tr>
  </table>
</body>
</html>`.trim()

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `[Step Weave] Weekly report — ${weekLabel}`,
      html,
    })
    if (error) {
      console.error('Resend sendWeeklyAdminReport:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Resend sendWeeklyAdminReport exception:', message)
    return { ok: false, error: message }
  }
}

/** Convenience wrapper for fulfillment failures — keeps existing call sites simple. */
export function sendFulfillmentFailureAlert(params: {
  orderId: number
  reason: string
}): Promise<{ ok: boolean; error?: string }> {
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.stepweave.com').replace(/\/$/, '')
  return sendAdminAlert({
    subject: `Fulfillment failed — Order #${params.orderId}`,
    title: `Fulfillment failed — Order #${params.orderId}`,
    body: `A Printful order submission failed after payment was received. Error: <strong>${escapeHtml(params.reason)}</strong>`,
    detail: `curl -X POST ${origin}/api/admin/retry-fulfillment \\\n  -H "Content-Type: application/json" \\\n  -H "x-admin-secret: YOUR_ADMIN_SECRET" \\\n  -d '{"orderId": ${params.orderId}}'`,
  })
}

/**
 * Send welcome email to a newly created account.
 * No-op if RESEND_API_KEY is not set.
 */
export async function sendWelcomeEmail(params: {
  to: string
  username: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Resend] RESEND_API_KEY not set; skipping welcome email to', params.to)
    }
    return { ok: true }
  }

  const { to, username } = params
  const origin = defaultOrigin.replace(/\/$/, '')
  const exploreUrl = `${origin}/explore`
  const designUrl = `${origin}/design`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
  <h1 style="font-size:1.5rem;margin:0 0 8px;">Welcome to Step Weave, ${escapeHtml(username)}!</h1>
  <p style="color:#555;margin:0 0 24px;">You're all set. Here's what you can do:</p>
  <ul style="padding-left:20px;color:#333;line-height:2;">
    <li>Browse unique shoe designs from independent creators</li>
    <li>Design your own custom shoes with our AI design tool</li>
    <li>Order your design — printed and shipped directly to you</li>
  </ul>
  <p style="margin-top:24px;">
    <a href="${exploreUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;margin-right:12px;">Explore designs</a>
    <a href="${designUrl}" style="display:inline-block;color:#0066cc;font-weight:600;padding:12px 0;">Create your own →</a>
  </p>
</body>
</html>`.trim()

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to.trim(),
      subject: `Welcome to Step Weave, ${username}!`,
      html,
    })
    if (error) {
      console.error('Resend sendWelcomeEmail:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Resend sendWelcomeEmail exception:', message)
    return { ok: false, error: message }
  }
}

/**
 * Send order shipped email with tracking info.
 * No-op if RESEND_API_KEY is not set.
 */
export async function sendOrderShippedEmail(params: {
  to: string
  orderNumber: number
  trackingNumber: string | null
  trackingUrl: string | null
  carrier: string | null
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Resend] RESEND_API_KEY not set; skipping order shipped email to', params.to)
    }
    return { ok: true }
  }

  const { to, orderNumber, trackingNumber, trackingUrl, carrier } = params
  const origin = defaultOrigin.replace(/\/$/, '')
  const profileUrl = `${origin}/profile`

  const trackingBlock = trackingUrl
    ? `<p style="margin:16px 0;"><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">Track your package</a></p>`
    : trackingNumber
    ? `<p style="margin:16px 0;color:#333;">Tracking number: <strong>${escapeHtml(trackingNumber)}</strong>${carrier ? ` (${escapeHtml(carrier)})` : ''}</p>`
    : ''

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
  <h1 style="font-size:1.5rem;margin:0 0 8px;">Your order is on its way!</h1>
  <p style="color:#555;margin:0 0 16px;">Order <strong>#${orderNumber}</strong> has shipped and is heading to you.</p>
  ${trackingBlock}
  <p style="margin-top:24px;"><a href="${profileUrl}" style="color:#0066cc;font-weight:600;">View your orders</a></p>
</body>
</html>`.trim()

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to.trim(),
      subject: `Your Step Weave order #${orderNumber} has shipped!`,
      html,
    })
    if (error) {
      console.error('Resend sendOrderShippedEmail:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Resend sendOrderShippedEmail exception:', message)
    return { ok: false, error: message }
  }
}

/**
 * Send a 7-day post performance summary to a creator.
 * No-op if RESEND_API_KEY is not set.
 */
export async function sendCreatorStatsEmail(params: {
  to: string
  username: string
  productName: string
  productId: number
  views: number
  likes: number
  orders: number
  revenueEarned: number
  currency: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Resend] RESEND_API_KEY not set; skipping creator stats email to', params.to)
    }
    return { ok: true }
  }

  const { to, username, productName, productId, views, likes, orders, revenueEarned, currency } = params
  const origin = defaultOrigin.replace(/\/$/, '')
  const productUrl = `${origin}/item/${productId}`

  const revenueBlock = revenueEarned > 0
    ? `<tr><td style="padding:10px 0;color:#555;border-bottom:1px solid #eee;">Revenue earned</td><td style="padding:10px 0;text-align:right;font-weight:600;border-bottom:1px solid #eee;">${formatCurrency(revenueEarned, currency)}</td></tr>`
    : ''

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
  <h1 style="font-size:1.5rem;margin:0 0 4px;">Your first week on Step Weave</h1>
  <p style="color:#555;margin:0 0 24px;">Here's how <strong>${escapeHtml(productName)}</strong> performed in its first 7 days.</p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="padding:10px 0;color:#555;border-bottom:1px solid #eee;">Views</td>
      <td style="padding:10px 0;text-align:right;font-weight:600;border-bottom:1px solid #eee;">${views.toLocaleString()}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;color:#555;border-bottom:1px solid #eee;">Likes</td>
      <td style="padding:10px 0;text-align:right;font-weight:600;border-bottom:1px solid #eee;">${likes.toLocaleString()}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;color:#555;border-bottom:1px solid #eee;">Orders</td>
      <td style="padding:10px 0;text-align:right;font-weight:600;border-bottom:1px solid #eee;">${orders.toLocaleString()}</td>
    </tr>
    ${revenueBlock}
  </table>

  <p style="margin:0 0 24px;"><a href="${productUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">View your listing</a></p>

  <p style="color:#999;font-size:0.875rem;margin:0;">Keep designing — the Step Weave team</p>
</body>
</html>`.trim()

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to.trim(),
      subject: `How did ${productName} do this week?`,
      html,
    })
    if (error) {
      console.error('Resend sendCreatorStatsEmail:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Resend sendCreatorStatsEmail exception:', message)
    return { ok: false, error: message }
  }
}

/**
 * Send "you have money waiting — set up Stripe" email to a creator whose Connect
 * account isn't ready yet. email_type: 'day0' or 'day3'.
 */
export async function sendPendingPayoutEmail(params: {
  to: string
  username: string
  amountDollars: number
  currency: string
  emailType: 'day0' | 'day3'
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Resend] RESEND_API_KEY not set; skipping pending payout email to', params.to)
    }
    return { ok: true }
  }

  const { to, username, amountDollars, currency, emailType } = params
  const origin = defaultOrigin.replace(/\/$/, '')
  const stripeSetupUrl = `${origin}/profile?tab=earnings`
  const formattedAmount = formatCurrency(amountDollars, currency)

  const subject = emailType === 'day0'
    ? `You earned ${formattedAmount} on Step Weave — claim it now`
    : `Reminder: ${formattedAmount} is still waiting for you on Step Weave`

  const headline = emailType === 'day0'
    ? `Someone bought your design!`
    : `Your earnings are still unclaimed`

  const body = emailType === 'day0'
    ? `Great news — someone just purchased your shoe design and you earned <strong>${formattedAmount}</strong>. To receive your payout, you just need to connect your Stripe account. It takes about 2 minutes.`
    : `Just a reminder that you have <strong>${formattedAmount}</strong> waiting for you from a recent sale. Connect your Stripe account to get paid.`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
  <h1 style="font-size:1.5rem;margin:0 0 8px;">${headline}</h1>
  <p style="color:#333;margin:0 0 24px;">${body}</p>
  <p style="margin:0 0 24px;">
    <a href="${escapeHtml(stripeSetupUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">Connect Stripe &amp; get paid</a>
  </p>
  <p style="color:#999;font-size:0.875rem;margin:0;">Once connected, your earnings will be transferred automatically for this and all future sales.</p>
</body>
</html>`.trim()

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to.trim(),
      subject,
      html,
    })
    if (error) {
      console.error('Resend sendPendingPayoutEmail:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Resend sendPendingPayoutEmail exception:', message)
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
