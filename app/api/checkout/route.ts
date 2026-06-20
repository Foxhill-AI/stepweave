import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  getCartItems,
  createOrder,
  createOrderItems,
  updateOrderStripeCheckoutSession,
  getDesignDraftSnapshotForUser,
  type CartItemRow,
  type CreateOrderItemInput,
} from '@/lib/supabaseClient'
import { resolveDesignSnapshotForProductCheckout } from '@/lib/checkout/resolveDesignSnapshotForProduct'
import { getPlatformFeeBpsByTier, getCreatorShareRate, splitLineByMargin } from '@/lib/platformFee'

/** Body `designDraftByCartItemId`: maps cart_item.id → design_draft.id (must belong to cart owner). */
function parseDesignDraftByCartItemId(
  raw: unknown,
  cartItemIds: Set<number>
): Map<number, number> {
  const m = new Map<number, number>()
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return m
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const cartItemId = Number(k)
    const draftId = typeof v === 'number' ? v : Number(v)
    if (!Number.isInteger(cartItemId) || cartItemId <= 0 || !cartItemIds.has(cartItemId)) continue
    if (!Number.isInteger(draftId) || draftId <= 0) continue
    m.set(cartItemId, draftId)
  }
  return m
}

function buildVariantLabel(row: CartItemRow): string | null {
  if (row.variant_label != null && String(row.variant_label).trim() !== '') {
    return String(row.variant_label).trim()
  }
  const pv = row.product_variant
  if (!pv?.product_variant_attribute_option?.length) return null
  const labels = pv.product_variant_attribute_option
    .map((p) => p.attribute_option?.label)
    .filter(Boolean) as string[]
  return labels.length > 0 ? labels.join(' / ') : null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'You must be signed in to checkout' },
        { status: 401 }
      )
    }

    const { data: userAccount } = await supabase
      .from('user_account')
      .select('id')
      .eq('auth_user_id', authUser.id)
      .maybeSingle()
    if (!userAccount?.id) {
      return NextResponse.json(
        { error: 'User account not found' },
        { status: 403 }
      )
    }
    const userAccountId = userAccount.id as number

    const body = await request.json().catch(() => ({}))
    const cartId = typeof body.cartId === 'number' ? body.cartId : Number(body.cartId)
    if (!Number.isInteger(cartId) || cartId <= 0) {
      return NextResponse.json(
        { error: 'Invalid or missing cartId' },
        { status: 400 }
      )
    }
    const shippingAmount = typeof body.shipping === 'number' ? Math.max(0, body.shipping) : 0
    const taxesAmount = typeof body.taxes === 'number' ? Math.max(0, body.taxes) : 0

    const { data: cart } = await supabase
      .from('cart')
      .select('id')
      .eq('id', cartId)
      .eq('user_account_id', userAccountId)
      .maybeSingle()
    if (!cart) {
      return NextResponse.json(
        { error: 'Cart not found or access denied' },
        { status: 404 }
      )
    }

    const cartItems = await getCartItems(cartId, supabase)
    if (cartItems.length === 0) {
      return NextResponse.json(
        { error: 'Your cart is empty' },
        { status: 400 }
      )
    }

    const cartItemIdSet = new Set(cartItems.map((r) => r.id))
    const draftMap = parseDesignDraftByCartItemId(body.designDraftByCartItemId, cartItemIdSet)

    const resolvedDrafts = new Map<number, { draftId: number; snapshot: Record<string, unknown> }>()

    for (const row of cartItems) {
      const product = row.product_variant?.product
      const productId = product?.id
      const designData = product?.design_data
      const isPrintfulListing =
        productId != null &&
        designData &&
        typeof designData === 'object' &&
        !Array.isArray(designData) &&
        (designData as Record<string, unknown>).source === 'design_draft'

      if (isPrintfulListing) {
        const resolved = await resolveDesignSnapshotForProductCheckout(productId)
        if (!resolved) {
          return NextResponse.json(
            {
              error:
                'A customizable product in your cart cannot be fulfilled (missing design link or server config). Remove it or contact support.',
            },
            { status: 400 }
          )
        }
        resolvedDrafts.set(row.id, {
          draftId: resolved.draftId,
          snapshot: { ...resolved.snapshot } as Record<string, unknown>,
        })
        continue
      }

      const draftIdFromClient = draftMap.get(row.id)
      if (draftIdFromClient != null) {
        const resolved = await getDesignDraftSnapshotForUser(draftIdFromClient, userAccountId, supabase)
        if (!resolved) {
          return NextResponse.json(
            { error: `Invalid or unauthorized design draft for cart item ${row.id}` },
            { status: 400 }
          )
        }
        resolvedDrafts.set(row.id, {
          draftId: resolved.draftId,
          snapshot: { ...resolved.snapshot } as Record<string, unknown>,
        })
      }
    }

    // Look up each seller's subscription tier so the correct creator share is applied.
    const sellerIds = Array.from(
      new Set(
        cartItems
          .map((row) => {
            const uid = row.product_variant?.product?.user_account_id
            return typeof uid === 'number' ? uid : null
          })
          .filter((id): id is number => id !== null)
      )
    )

    const sellerTierMap = new Map<number, string>()
    if (sellerIds.length > 0) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (supabaseUrl && serviceRoleKey) {
        const admin = createClient(supabaseUrl, serviceRoleKey)
        const { data: sellerRows } = await admin
          .from('user_account')
          .select('id, subscription_tier')
          .in('id', sellerIds)
        if (sellerRows) {
          for (const row of sellerRows) {
            if (typeof row.id === 'number' && row.subscription_tier) {
              sellerTierMap.set(row.id, String(row.subscription_tier))
            }
          }
        }
      }
    }

    const orderItems: CreateOrderItemInput[] = cartItems.map((row) => {
      const product = row.product_variant?.product
      const productId = product?.id ?? 0
      const productName = product?.name ?? 'Product'
      const unitPrice = Number(row.unit_price_at_added)
      const quantity = row.quantity
      const lineSubtotal = quantity * unitPrice
      const sellerId =
        product != null && typeof product.user_account_id === 'number'
          ? product.user_account_id
          : null
      const sellerTier = sellerId != null ? (sellerTierMap.get(sellerId) ?? 'free') : 'free'
      const creatorShareRate = getCreatorShareRate(sellerTier)
      const baseCostPerUnit = typeof product?.base_cost === 'number' ? product.base_cost : 0
      const baseCostTotal = baseCostPerUnit * quantity
      const { platformFeeAmount, sellerNetAmount, effectiveFeeBps } = splitLineByMargin(
        lineSubtotal,
        baseCostTotal,
        creatorShareRate
      )
      const base: CreateOrderItemInput = {
        product_id: productId,
        product_variant_id: row.product_variant_id,
        product_name: productName,
        variant_label: buildVariantLabel(row) ?? undefined,
        quantity,
        unit_price: unitPrice,
        stripe_price_id: row.product_variant?.stripe_price_id ?? undefined,
        seller_user_account_id: sellerId,
        platform_fee_rate_bps: effectiveFeeBps,
        platform_fee_amount: platformFeeAmount,
        seller_net_amount: sellerNetAmount,
      }
      const linked = resolvedDrafts.get(row.id)
      if (linked) {
        base.design_draft_id = linked.draftId
        base.design_snapshot = linked.snapshot
      }
      return base
    })

    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    )
    if (subtotal <= 0) {
      return NextResponse.json(
        { error: 'Invalid cart total' },
        { status: 400 }
      )
    }
    const totalAmount = subtotal + shippingAmount + taxesAmount
    const platformFeeTotal = orderItems.reduce((s, i) => s + (i.platform_fee_amount ?? 0), 0)
    const sellerNetTotal = orderItems.reduce((s, i) => s + (i.seller_net_amount ?? 0), 0)

    const order = await createOrder(userAccountId, totalAmount, 'usd', supabase, {
      platformFeeTotal,
      sellerNetTotal,
    })
    if (!order) {
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      )
    }

    const ok = await createOrderItems(order.id, orderItems, supabase)
    if (!ok) {
      return NextResponse.json(
        { error: 'Failed to create order items' },
        { status: 500 }
      )
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY
    if (!stripeSecret) {
      return NextResponse.json(
        { error: 'Checkout is not configured' },
        { status: 503 }
      )
    }

    const stripe = new Stripe(stripeSecret)
    const origin = request.nextUrl.origin

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = orderItems.map(
      (item) => ({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(item.unit_price * 100),
          product_data: {
            name: item.product_name,
            ...(item.variant_label
              ? { description: `Size: ${item.variant_label}` }
              : {}),
          },
        },
        quantity: item.quantity,
      })
    )
    if (shippingAmount > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(shippingAmount * 100),
          product_data: { name: 'Shipping' },
        },
        quantity: 1,
      })
    }
    if (taxesAmount > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(taxesAmount * 100),
          product_data: { name: 'Taxes & fees' },
        },
        quantity: 1,
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/order/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
      metadata: { order_id: String(order.id) },
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'MX', 'GB', 'DE', 'FR', 'ES', 'IT', 'AU', 'AT', 'BE', 'NL', 'PT', 'PL', 'BR', 'AR', 'CL', 'CO', 'PE'],
      },
    })

    const updated = await updateOrderStripeCheckoutSession(
      order.id,
      session.id,
      supabase
    )
    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to link order to checkout session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout API error:', err)
    return NextResponse.json(
      { error: 'An error occurred during checkout' },
      { status: 500 }
    )
  }
}
