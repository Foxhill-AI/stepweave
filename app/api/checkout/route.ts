import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  getCartItems,
  createOrder,
  createOrderItems,
  updateOrderStripeCheckoutSession,
  type CartItemRow,
  type CreateOrderItemInput,
} from '@/lib/supabaseClient'

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

    const orderItems: CreateOrderItemInput[] = cartItems.map((row) => {
      const product = row.product_variant?.product
      const productId = product?.id ?? 0
      const productName = product?.name ?? 'Product'
      const unitPrice = Number(row.unit_price_at_added)
      const quantity = row.quantity
      return {
        product_id: productId,
        product_variant_id: row.product_variant_id,
        product_name: productName,
        variant_label: buildVariantLabel(row) ?? undefined,
        quantity,
        unit_price: unitPrice,
        stripe_price_id: row.product_variant?.stripe_price_id ?? undefined,
      }
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

    const order = await createOrder(userAccountId, totalAmount, 'usd', supabase)
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
      (item) => {
        if (item.stripe_price_id) {
          return {
            price: item.stripe_price_id,
            quantity: item.quantity,
          }
        }
        return {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(item.unit_price * 100),
            product_data: {
              name: item.product_name,
              ...(item.variant_label
                ? { description: `Variant: ${item.variant_label}` }
                : {}),
            },
          },
          quantity: item.quantity,
        }
      }
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
