import { PRINTFUL_BASE } from '@/lib/printful/mockupTask'
import type { PrintfulOrderLineFile } from '@/lib/printful/prepareOrderPrintFiles'

export type PrintfulSubmitRecipient = {
  name: string
  address1: string
  address2?: string
  city: string
  state_code: string
  country_code: string
  zip: string
  phone?: string
  email?: string
}

export type PrintfulOrderLineItem = {
  variant_id: number
  quantity: number
  files: PrintfulOrderLineFile[]
}

/**
 * POST https://api.printful.com/orders — creates a draft or confirmed order (see `confirm`).
 */
export async function submitPrintfulOrder(params: {
  externalId: string
  recipient: PrintfulSubmitRecipient
  items: PrintfulOrderLineItem[]
  /** When true, adds ?confirm=1 so Printful charges and sends to fulfillment (production). */
  confirm: boolean
}): Promise<
  | { ok: true; printfulOrderId: number }
  | { ok: false; reason: string; status?: number; raw?: string }
> {
  const apiKey = process.env.PRINTFUL_API_KEY
  const storeId = process.env.PRINTFUL_STORE_ID?.trim()
  if (!apiKey?.trim() || !storeId) {
    return { ok: false, reason: 'Printful API not configured' }
  }

  const { externalId, recipient, items, confirm } = params
  if (items.length === 0) {
    return { ok: false, reason: 'No line items' }
  }

  const url = confirm
    ? `${PRINTFUL_BASE}/orders?confirm=1`
    : `${PRINTFUL_BASE}/orders`

  const body: Record<string, unknown> = {
    external_id: externalId,
    shipping: 'STANDARD',
    recipient: {
      name: recipient.name,
      address1: recipient.address1,
      ...(recipient.address2?.trim() ? { address2: recipient.address2 } : {}),
      city: recipient.city,
      state_code: recipient.state_code,
      country_code: recipient.country_code,
      zip: recipient.zip,
      ...(recipient.phone?.trim() ? { phone: recipient.phone.trim() } : {}),
      ...(recipient.email?.trim() ? { email: recipient.email.trim() } : {}),
    },
    items: items.map((it) => ({
      variant_id: it.variant_id,
      quantity: it.quantity,
      files: it.files.map((f) => ({
        type: f.type,
        url: f.url,
        position: f.position,
      })),
    })),
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
      'X-PF-Store-Id': storeId,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let parsed: { code?: number; result?: { id?: number } | string; error?: { message?: string } }
  try {
    parsed = JSON.parse(text) as typeof parsed
  } catch {
    return { ok: false, reason: 'Invalid Printful response', status: res.status, raw: text.slice(0, 500) }
  }

  if (!res.ok || parsed.code !== 200) {
    const msg =
      typeof parsed.result === 'string'
        ? parsed.result
        : parsed.error?.message ?? `Printful error (${res.status})`
    return { ok: false, reason: msg, status: res.status, raw: text.slice(0, 800) }
  }

  const id = parsed.result && typeof parsed.result === 'object' ? parsed.result.id : undefined
  if (typeof id !== 'number' || !Number.isFinite(id)) {
    return { ok: false, reason: 'Printful response missing order id', raw: text.slice(0, 500) }
  }

  return { ok: true, printfulOrderId: id }
}
