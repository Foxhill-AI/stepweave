import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

// Get Supabase URL and Anon Key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase environment variables. Please check your .env file.'
  )
}

/** Use before OAuth to avoid redirecting to a broken URL (e.g. your domain/v1/auth/v1/oauth). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

const authOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
}

/**
 * Browser: use createBrowserClient so the session is stored in cookies and
 * the server (API routes) can read it. Node/API: use createClient (server
 * auth uses createServerSupabaseClient() which reads the same cookies).
 */
export const supabase =
  typeof window !== 'undefined'
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : createClient(supabaseUrl, supabaseAnonKey, authOptions)
  
  // Helper function to get the current user
  export const getCurrentUser = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    
    if (error) {
      console.error('Error getting current user:', error)
      return null
    }
    
    return user
  }
  
  // Helper function to get the current session
  export const getCurrentSession = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Error getting current session:', error)
      return null
    }
    
    return session
  }

  export const getCurrentUserAccount = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return null
    const { data, error } = await supabase
      .from('user_account')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (error) {
      console.error('Error getting user_account:', error)
      return null
    }
    return data
  }

  /** Public profile by username (for creator links). */
  export type PublicProfileRow = {
    id: number
    username: string
    avatar_url: string | null
    bio: string | null
  }

  export async function getPublicProfileByUsername(username: string): Promise<PublicProfileRow | null> {
    if (!username.trim()) return null
    const { data, error } = await supabase
      .from('user_account')
      .select('id, username, avatar_url, bio')
      .eq('username', username.trim())
      .maybeSingle()
    if (error) {
      console.error('getPublicProfileByUsername:', error)
      return null
    }
    return data as PublicProfileRow | null
  }

  /** Public profile by user_account_id (for product creator display; readable by anyone). */
  export async function getPublicProfileByUserAccountId(
    userAccountId: number
  ): Promise<{ username: string; avatar_url: string | null; bio: string | null } | null> {
    const { data, error } = await supabase
      .from('user_public_profile')
      .select('username, avatar_url, bio')
      .eq('user_account_id', userAccountId)
      .maybeSingle()
    if (error) {
      console.error('getPublicProfileByUserAccountId:', error)
      return null
    }
    return data as { username: string; avatar_url: string | null; bio: string | null } | null
  }

  /** Update profile (bio, avatar_url, username) in user_account and user_public_profile. */
  export async function updateUserProfile(
    userAccountId: number,
    data: { username?: string; bio?: string | null; avatar_url?: string | null }
  ): Promise<{ error: Error | null }> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (data.username !== undefined) payload.username = data.username
    if (data.bio !== undefined) payload.bio = data.bio
    if (data.avatar_url !== undefined) payload.avatar_url = data.avatar_url

    const { error: errAccount } = await supabase
      .from('user_account')
      .update(payload)
      .eq('id', userAccountId)
    if (errAccount) {
      console.error('updateUserProfile user_account:', errAccount)
      return { error: errAccount }
    }

    const publicPayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.username !== undefined) publicPayload.username = data.username
    if (data.bio !== undefined) publicPayload.bio = data.bio
    if (data.avatar_url !== undefined) publicPayload.avatar_url = data.avatar_url

    const { error: errPublic } = await supabase
      .from('user_public_profile')
      .update(publicPayload)
      .eq('user_account_id', userAccountId)
    if (errPublic) {
      console.error('updateUserProfile user_public_profile:', errPublic)
      return { error: errPublic }
    }
    return { error: null }
  }

  // ---------------------------------------------------------------------------
  // Products & categories (listings + detail)
  // ---------------------------------------------------------------------------

  /** Category row from DB (for filters / Explore). */
  export type CategoryRow = {
    id: number
    name: string
    slug: string
    parent_id: number | null
    created_at: string
  }

  /** Product with categories and author for list views. */
  export type ProductListingRow = {
    id: number
    name: string
    price: number
    status: string
    design_data: Record<string, unknown> | null
    user_account_id: number
    created_at: string
    product_category: Array<{
      category_id: number
      category: { id: number; name: string; slug: string } | null
    }>
    user_account: { username: string; avatar_url?: string | null; bio?: string | null } | null
    /** First active variant (for Add to cart from listing). */
    product_variant?: Array<{ id: number; price_override: number | null }>
  }

  /** Attribute option with attribute info (for variant/attribute display). */
  export type AttributeOptionRow = {
    id: number
    label: string
    attribute: { id: number; name: string; slug: string } | null
  }

  /** Product by id with categories, variants, and attribute options for detail page. */
  export type ProductDetailRow = ProductListingRow & {
    /** Creator public info (from user_public_profile); set by getProductById for guest-safe display. */
    user_public_profile?: { username: string; avatar_url: string | null; bio: string | null } | null
    product_variant: Array<{
      id: number
      product_id: number
      price_override: number | null
      status: string
      product_variant_attribute_option?: Array<{
        attribute_option_id: number
        attribute_option?: AttributeOptionRow | null
      }>
    }>
    product_attribute_option?: Array<{
      attribute_option_id: number
      attribute_option?: AttributeOptionRow | null
    }>
  }

  export async function getCategories(): Promise<CategoryRow[]> {
    const { data, error } = await supabase
      .from('category')
      .select('id, name, slug, parent_id, created_at')
      .order('name')
    if (error) {
      console.error('getCategories:', error)
      return []
    }
    return (data ?? []) as CategoryRow[]
  }

  const productListingSelect = `
    id,
    name,
    price,
    status,
    design_data,
    user_account_id,
    created_at,
    product_category (
      category_id,
      category ( id, name, slug )
    ),
    user_account ( username ),
    product_variant ( id, price_override )
  `

  /** Hero: products only (no user_account join). Creator profile comes from user_public_profile so any visitor can see it. */
  const productListingSelectForHero = `
    id,
    name,
    price,
    status,
    design_data,
    user_account_id,
    created_at,
    product_category (
      category_id,
      category ( id, name, slug )
    ),
    product_variant ( id, price_override )
  `

  export type FeaturedCreatorForHero = {
    profile: { userAccountId: number; avatar: string; name: string; followers: string; description: string }
    products: ProductListingRow[]
  }

  /** Fetch up to 3 creators with active products, each with up to 3 products, for the homepage hero carousel.
   * Uses user_public_profile for username, avatar_url, and bio so that any visitor (including not signed in) can see them. */
  export async function getFeaturedCreatorsForHero(): Promise<FeaturedCreatorForHero[]> {
    const { data, error } = await supabase
      .from('product')
      .select(productListingSelectForHero)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('getFeaturedCreatorsForHero:', error)
      return []
    }
    const rows = (data ?? []) as unknown as ProductListingRow[]
    const byOwner = new Map<number, ProductListingRow[]>()
    for (const row of rows) {
      const id = row.user_account_id
      const list = byOwner.get(id) ?? []
      if (list.length < 3) list.push(row)
      byOwner.set(id, list)
    }
    const creatorIds = Array.from(byOwner.entries())
      .filter(([, products]) => products.length > 0)
      .slice(0, 3)
      .map(([id]) => id)

    if (creatorIds.length === 0) return []

    const [publicProfiles, statsList] = await Promise.all([
      Promise.all(creatorIds.map((id) => getPublicProfileByUserAccountId(id))),
      Promise.all(creatorIds.map((id) => getProfileStats(id).catch(() => ({ followers: 0, following: 0, products: 0, likesReceived: 0 })))),
    ])
    const sections: FeaturedCreatorForHero[] = creatorIds.map((id, i) => {
      const products = byOwner.get(id) ?? []
      const publicProfile = publicProfiles[i]
      const username = publicProfile?.username?.trim() || 'Creator'
      const avatarUrl = publicProfile?.avatar_url?.trim()
      const avatar = avatarUrl || username.charAt(0).toUpperCase()
      const bio = publicProfile?.bio?.trim() || ''
      const stats = statsList[i]
      const followers = stats ? (stats.followers >= 1000 ? `${(stats.followers / 1000).toFixed(1)}k` : String(stats.followers)) : '0'
      return {
        profile: {
          userAccountId: id,
          avatar,
          name: username,
          followers: `${followers} followers`,
          description: bio || 'Explore unique designs and join our creative community.',
        },
        products,
      }
    })
    return sections
  }

  export async function getActiveProducts(categorySlug?: string): Promise<ProductListingRow[]> {
    const { data, error } = await supabase
      .from('product')
      .select(productListingSelect)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('getActiveProducts:', error)
      return []
    }
    const rows = (data ?? []) as unknown as ProductListingRow[]
    if (!categorySlug || categorySlug === 'all') return rows
    return rows.filter((p) =>
      p.product_category?.some(
        (pc) => pc.category?.slug === categorySlug
      )
    )
  }

  /** Search active products by name and optional filters. For homepage browse / search. */
  export type SearchProductsFilters = {
    categorySlug?: string
    creatorUsername?: string
    dateCreated?: 'any' | 'week' | 'month' | 'year'
    /** Exact match: product name must equal this string (case insensitive). */
    exactMatch?: string
    /** Must contain: all these words (split by spaces) must appear in product name (case insensitive). */
    mustContain?: string
    /** Exclude: product name must not contain any of these words (split by spaces, case insensitive). */
    exclude?: string
  }

  function applyTextFilter(
    productName: string,
    inputValue: string,
    filterType: 'exact_match' | 'must_contain' | 'does_not_contain'
  ): boolean {
    const v = (productName || '').toLowerCase()
    const raw = (inputValue || '').trim()
    if (!raw) return true

    switch (filterType) {
      case 'exact_match':
        return v === raw.toLowerCase()
      case 'must_contain': {
        const words = raw.toLowerCase().split(/\s+/).filter(Boolean)
        return words.every((word) => v.includes(word))
      }
      case 'does_not_contain': {
        const words = raw.toLowerCase().split(/\s+/).filter(Boolean)
        return !words.some((word) => v.includes(word))
      }
      default:
        return true
    }
  }

  export async function searchProducts(
    q: string,
    filters?: SearchProductsFilters
  ): Promise<ProductListingRow[]> {
    const {
      categorySlug,
      creatorUsername,
      dateCreated,
      exactMatch,
      mustContain,
      exclude,
    } = filters ?? {}
    let query = supabase
      .from('product')
      .select(productListingSelect)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    const term = (q || '').trim()
    if (term) {
      query = query.ilike('name', `%${term}%`)
    }

    if (dateCreated && dateCreated !== 'any') {
      const since = new Date()
      if (dateCreated === 'week') since.setDate(since.getDate() - 7)
      else if (dateCreated === 'month') since.setMonth(since.getMonth() - 1)
      else if (dateCreated === 'year') since.setFullYear(since.getFullYear() - 1)
      query = query.gte('created_at', since.toISOString())
    }

    const { data, error } = await query
    if (error) {
      console.error('searchProducts:', error)
      return []
    }
    let rows = (data ?? []) as unknown as ProductListingRow[]

    if (categorySlug && categorySlug !== 'all') {
      rows = rows.filter((p) =>
        p.product_category?.some(
          (pc) => pc.category?.slug === categorySlug
        )
      )
    }

    if (creatorUsername && creatorUsername.trim()) {
      const match = creatorUsername.trim().toLowerCase()
      rows = rows.filter(
        (p) => p.user_account?.username?.toLowerCase().includes(match)
      )
    }

    if (exactMatch && exactMatch.trim()) {
      rows = rows.filter((p) =>
        applyTextFilter(p.name, exactMatch, 'exact_match')
      )
    }
    if (mustContain && mustContain.trim()) {
      rows = rows.filter((p) =>
        applyTextFilter(p.name, mustContain, 'must_contain')
      )
    }
    if (exclude && exclude.trim()) {
      rows = rows.filter((p) =>
        applyTextFilter(p.name, exclude, 'does_not_contain')
      )
    }

    return rows
  }

  export async function getProductById(id: string | number): Promise<ProductDetailRow | null> {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id
    if (Number.isNaN(numericId)) return null
    const { data, error } = await supabase
      .from('product')
      .select(`
        id,
        name,
        price,
        status,
        design_data,
        user_account_id,
        created_at,
        product_category (
          category_id,
          category ( id, name, slug )
        ),
        product_variant (
          id,
          price_override,
          status,
          product_variant_attribute_option (
            attribute_option_id,
            attribute_option ( id, label, attribute ( id, name, slug ) )
          )
        ),
        product_attribute_option (
          attribute_option_id,
          attribute_option ( id, label, attribute ( id, name, slug ) )
        )
      `)
      .eq('id', numericId)
      .single()
    if (error || !data) {
      if (error?.code !== 'PGRST116') console.error('getProductById:', error)
      return null
    }
    const row = data as Record<string, unknown>
    const userAccountId = row.user_account_id as number | undefined
    let user_public_profile: { username: string; avatar_url: string | null; bio: string | null } | null = null
    if (userAccountId != null) {
      user_public_profile = await getPublicProfileByUserAccountId(userAccountId)
    }
    return { ...row, user_public_profile, user_account: undefined } as unknown as ProductDetailRow
  }

  /** Products owned by the given user (all statuses). For "My products" tab. */
  export async function getProductsByUserAccountId(
    userAccountId: number
  ): Promise<ProductListingRow[]> {
    const { data, error } = await supabase
      .from('product')
      .select(`
        id,
        name,
        price,
        status,
        design_data,
        user_account_id,
        created_at,
        product_category (
          category_id,
          category ( id, name, slug )
        ),
        user_account ( username ),
        product_variant ( id, price_override )
      `)
      .eq('user_account_id', userAccountId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('getProductsByUserAccountId:', error)
      return []
    }
    return (data ?? []) as unknown as ProductListingRow[]
  }

  /** Update product (name, price, status, design_data). RLS: product_update_own. */
  export async function updateProduct(
    id: number,
    updates: {
      name?: string
      price?: number
      status?: 'draft' | 'active' | 'archived'
      design_data?: Record<string, unknown>
    }
  ): Promise<boolean> {
    const { error } = await supabase.from('product').update(updates).eq('id', id)
    if (error) {
      console.error('updateProduct:', error)
      return false
    }
    return true
  }

  /** Replace product categories. Deletes existing and inserts new. RLS: product_update_own. */
  export async function setProductCategories(
    productId: number,
    categoryIds: number[]
  ): Promise<boolean> {
    const { error: deleteError } = await supabase
      .from('product_category')
      .delete()
      .eq('product_id', productId)
    if (deleteError) {
      console.error('setProductCategories delete:', deleteError)
      return false
    }
    if (categoryIds.length === 0) return true
    const rows = categoryIds.map((category_id) => ({ product_id: productId, category_id }))
    const { error: insertError } = await supabase.from('product_category').insert(rows)
    if (insertError) {
      console.error('setProductCategories insert:', insertError)
      return false
    }
    return true
  }

  /** True if the product has at least one order (order_item). Use to block hard delete when product has sales. */
  export async function productHasOrders(productId: number): Promise<boolean> {
    const { data, error } = await supabase
      .from('order_item')
      .select('id')
      .eq('product_id', productId)
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('productHasOrders:', error)
      return true
    }
    return data != null
  }

  /** Delete product permanently (variants and links cascade). Only safe when product has no orders. RLS: product_delete_own. */
  export async function deleteProduct(id: number): Promise<boolean> {
    const { error } = await supabase.from('product').delete().eq('id', id)
    if (error) {
      console.error('deleteProduct:', error)
      return false
    }
    return true
  }

  /** Create product with one default variant and optional categories. RLS: product_insert_own. */
  export type CreateProductPayload = {
    name: string
    price: number
    status: 'draft' | 'active'
    design_data?: Record<string, unknown> | null
    categoryIds?: number[]
  }

  export async function createProduct(
    userAccountId: number,
    payload: CreateProductPayload
  ): Promise<{ id: number } | null> {
    const { data: product, error: productError } = await supabase
      .from('product')
      .insert({
        user_account_id: userAccountId,
        name: payload.name.trim(),
        price: payload.price,
        status: payload.status,
        design_data: payload.design_data ?? null,
      })
      .select('id')
      .single()
    if (productError || !product) {
      console.error('createProduct:', productError)
      return null
    }
    const productId = product.id as number

    if (payload.categoryIds?.length) {
      const { error: catError } = await supabase.from('product_category').insert(
        payload.categoryIds.map((category_id) => ({ product_id: productId, category_id }))
      )
      if (catError) {
        console.error('createProduct product_category:', catError)
        // product already created; continue
      }
    }

    const { error: variantError } = await supabase.from('product_variant').insert({
      product_id: productId,
      status: 'active',
      price_override: null,
    })
    if (variantError) {
      console.error('createProduct product_variant:', variantError)
      return null
    }

    return { id: productId }
  }

  // ---------------------------------------------------------------------------
  // Orders (for profile order history)
  // ---------------------------------------------------------------------------

  /** Order item row from DB (snapshot at purchase). */
  export type OrderItemRow = {
    id: number
    order_id: number
    product_id: number
    product_variant_id: number
    product_name: string
    variant_label: string | null
    quantity: number
    unit_price: number
    subtotal: number
    stripe_price_id: string | null
    created_at: string
  }

  /** Order row with items (for list/detail). */
  /** Shipping address shape stored from Stripe (shipping_details.address). */
  export type ShippingAddressRow = {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postal_code?: string | null
    country?: string | null
  }

  export type OrderWithItemsRow = {
    id: number
    user_account_id: number
    total_amount: number
    currency: string
    status: string
    paid_at: string | null
    created_at: string
    updated_at: string | null
    shipping_address: ShippingAddressRow | null
    order_item: OrderItemRow[]
  }

  /** Fetch orders for a user (with items). RLS: user sees only own orders. */
  export async function getOrdersByUserAccountId(
    userAccountId: number
  ): Promise<OrderWithItemsRow[]> {
    const { data, error } = await supabase
      .from('user_order')
      .select(
        `
        id,
        user_account_id,
        total_amount,
        currency,
        status,
        paid_at,
        created_at,
        updated_at,
        shipping_address,
        order_item (
          id,
          order_id,
          product_id,
          product_variant_id,
          product_name,
          variant_label,
          quantity,
          unit_price,
          subtotal,
          stripe_price_id,
          created_at
        )
      `
      )
      .eq('user_account_id', userAccountId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('getOrdersByUserAccountId:', error)
      return []
    }
    return (data ?? []) as OrderWithItemsRow[]
  }

  /** Input for one order item when creating an order from cart/checkout. */
  export type CreateOrderItemInput = {
    product_id: number
    product_variant_id: number
    product_name: string
    variant_label?: string | null
    quantity: number
    unit_price: number
    stripe_price_id?: string | null
  }

  /**
   * Create a new order (pending). Caller should then create order_item rows and later
   * set stripe_checkout_session_id after creating the Stripe session.
   * For guest checkout, user_account_id must be nullable in DB; until then pass a valid id.
   */
  export async function createOrder(
    userAccountId: number,
    totalAmount: number,
    currency: string = 'usd',
    client?: typeof supabase
  ): Promise<{ id: number } | null> {
    const db = client ?? supabase
    const { data, error } = await db
      .from('user_order')
      .insert({
        user_account_id: userAccountId,
        total_amount: totalAmount,
        currency: currency.toLowerCase(),
        status: 'pending',
      })
      .select('id')
      .single()
    if (error) {
      console.error('createOrder:', error)
      return null
    }
    return data
  }

  /**
   * Create order_item rows for an order. subtotal is computed as quantity * unit_price per item.
   */
  export async function createOrderItems(
    orderId: number,
    items: CreateOrderItemInput[],
    client?: typeof supabase
  ): Promise<boolean> {
    if (items.length === 0) return true
    const db = client ?? supabase
    const rows = items.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      product_variant_id: item.product_variant_id,
      product_name: item.product_name,
      variant_label: item.variant_label ?? null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.quantity * item.unit_price,
      stripe_price_id: item.stripe_price_id ?? null,
    }))
    const { error } = await db.from('order_item').insert(rows)
    if (error) {
      console.error('createOrderItems:', error)
      return false
    }
    return true
  }

  /**
   * Fetch a single order with its items by order ID (for webhook/email).
   * Uses the provided client (e.g. service role) so it works in webhooks.
   */
  export async function getOrderById(
    orderId: number,
    client?: typeof supabase
  ): Promise<OrderWithItemsRow | null> {
    const db = client ?? supabase
    const { data, error } = await db
      .from('user_order')
      .select(
        `
        id,
        user_account_id,
        total_amount,
        currency,
        status,
        paid_at,
        created_at,
        updated_at,
        shipping_address,
        order_item (
          id,
          order_id,
          product_id,
          product_variant_id,
          product_name,
          variant_label,
          quantity,
          unit_price,
          subtotal,
          stripe_price_id,
          created_at
        )
      `
      )
      .eq('id', orderId)
      .maybeSingle()
    if (error) {
      console.error('getOrderById:', error)
      return null
    }
    return data as unknown as OrderWithItemsRow | null
  }

  /**
   * Fetch a single order with its items by Stripe Checkout Session ID (for confirmation page).
   */
  export async function getOrderByStripeCheckoutSessionId(
    sessionId: string
  ): Promise<OrderWithItemsRow | null> {
    const { data, error } = await supabase
      .from('user_order')
      .select(
        `
        id,
        user_account_id,
        total_amount,
        currency,
        status,
        paid_at,
        created_at,
        updated_at,
        shipping_address,
        order_item (
          id,
          order_id,
          product_id,
          product_variant_id,
          product_name,
          variant_label,
          quantity,
          unit_price,
          subtotal,
          stripe_price_id,
          created_at
        )
      `
      )
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle()
    if (error) {
      console.error('getOrderByStripeCheckoutSessionId:', error)
      return null
    }
    return data as unknown as OrderWithItemsRow | null
  }

  /**
   * Update order with Stripe Checkout Session ID (after creating the session, before redirect).
   */
  export async function updateOrderStripeCheckoutSession(
    orderId: number,
    stripeCheckoutSessionId: string,
    client?: typeof supabase
  ): Promise<boolean> {
    const db = client ?? supabase
    const { data, error } = await db
      .from('user_order')
      .update({ stripe_checkout_session_id: stripeCheckoutSessionId })
      .eq('id', orderId)
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('updateOrderStripeCheckoutSession:', error)
      return false
    }
    // RLS can block the update without returning an error; then data is null
    return data != null
  }

  /**
   * Mark order as paid (for Stripe webhook: checkout.session.completed).
   * Sets status to 'paid', paid_at to now, and optionally shipping_address.
   */
  export async function updateOrderPaid(
    orderId: number,
    client?: typeof supabase,
    shippingAddress?: ShippingAddressRow | null
  ): Promise<boolean> {
    const db = client ?? supabase
    const now = new Date().toISOString()
    const payload: { status: string; paid_at: string; shipping_address?: ShippingAddressRow | null } = {
      status: 'paid',
      paid_at: now,
    }
    if (shippingAddress != null) {
      payload.shipping_address = shippingAddress
    }
    const { error } = await db
      .from('user_order')
      .update(payload)
      .eq('id', orderId)
    if (error) {
      console.error('updateOrderPaid:', error)
      return false
    }
    return true
  }

  // ---------------------------------------------------------------------------
  // Articles / Blog (published only for public)
  // ---------------------------------------------------------------------------

  export type ArticleRow = {
    id: number
    title: string
    slug: string
    content: string
    summary: string | null
    seo_title: string | null
    seo_description: string | null
    status: string
    author_user_account_id: number | null
    published_at: string | null
    created_at: string
    updated_at: string | null
    user_account?: { username: string } | null
  }

  const articleSelect = `
    id,
    title,
    slug,
    content,
    summary,
    seo_title,
    seo_description,
    status,
    author_user_account_id,
    published_at,
    created_at,
    updated_at,
    user_account:author_user_account_id ( username )
  `

  /** Fetch published articles (status = published, published_at <= now). */
  export async function getPublishedArticles(): Promise<ArticleRow[]> {
    const { data, error } = await supabase
      .from('article')
      .select(articleSelect)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })

    if (error) {
      console.error('getPublishedArticles:', error)
      return []
    }
    return (data ?? []) as unknown as ArticleRow[]
  }

  /** Fetch published articles with pagination and optional search (for blog index). */
  export async function getPublishedArticlesPaginated(
    limit: number,
    offset: number,
    search?: string,
    /** When provided (e.g. service-role in API route), bypasses RLS so published articles always load. */
    client?: { from: (table: string) => unknown }
  ): Promise<{ articles: ArticleRow[]; total: number }> {
    // Supabase client untyped; .from('article') builder type doesn't expose .eq. Cast via unknown to allow filter chain.
    type ArticleFilterBuilder = { eq: (...a: unknown[]) => ArticleFilterBuilder; not: (...a: unknown[]) => ArticleFilterBuilder; lte: (...a: unknown[]) => ArticleFilterBuilder; or: (s: string) => ArticleFilterBuilder; select: (...a: unknown[]) => unknown; order: (...a: unknown[]) => unknown; range: (a: number, b: number) => unknown }
    const db = client ?? supabase
    const base = (db.from('article') as unknown as ArticleFilterBuilder)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())

    const term = search?.trim().replace(/,/g, '')
    const pattern = term ? `%${term}%` : ''
    const withSearch = pattern
      ? base.or(`title.ilike.${pattern},summary.ilike.${pattern},content.ilike.${pattern}`)
      : base

    const [countRes, queryRes] = await Promise.all([
      withSearch.select('id', { count: 'exact', head: true }),
      (withSearch as { select: (...a: unknown[]) => { order: (...a: unknown[]) => { range: (a: number, b: number) => Promise<{ data: unknown; error: unknown }> } } })
        .select(articleSelect)
        .order('published_at', { ascending: false })
        .range(offset, offset + limit - 1),
    ])
    const count = (countRes as { count: number | null } | null)?.count ?? null
    const { data, error } = (queryRes as { data: ArticleRow[] | null; error: unknown }) ?? { data: null, error: null }

    if (error) {
      console.error('getPublishedArticlesPaginated:', error)
      return { articles: [], total: 0 }
    }
    return {
      articles: (data ?? []) as unknown as ArticleRow[],
      total: count ?? 0,
    }
  }

  /** Fetch a single published article by slug (for /blog/[slug]). */
  export async function getArticleBySlug(slug: string): Promise<ArticleRow | null> {
    const { data, error } = await supabase
      .from('article')
      .select(
        `
        id,
        title,
        slug,
        content,
        summary,
        seo_title,
        seo_description,
        status,
        author_user_account_id,
        published_at,
        created_at,
        updated_at,
        user_account:author_user_account_id ( username )
      `
      )
      .eq('slug', slug)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .maybeSingle()

    if (error) {
      console.error('getArticleBySlug:', error)
      return null
    }
    return data as ArticleRow | null
  }

  // ---------------------------------------------------------------------------
  // Newsletter & Contact (public inserts)
  // ---------------------------------------------------------------------------

  /** Subscribe an email to the newsletter. RLS: public insert. */
  export async function subscribeNewsletter(email: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase
      .from('newsletter_subscriber')
      .insert({ email: email.trim().toLowerCase(), status: 'active' })

    if (error) {
      if (error.code === '23505') {
        return { ok: true }
      }
      console.error('subscribeNewsletter:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  }

  /** Submit a contact form message. RLS: public insert. */
  export async function createContactSubmission(params: {
    name?: string | null
    email: string
    subject?: string | null
    message: string
  }): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('contact_submission').insert({
      name: params.name?.trim() || null,
      email: params.email.trim(),
      subject: params.subject?.trim() || null,
      message: params.message.trim(),
      status: 'new',
    })

    if (error) {
      console.error('createContactSubmission:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  }

  // ---------------------------------------------------------------------------
  // Product stats & views (product_interaction)
  // ---------------------------------------------------------------------------

  /** Get like and view counts for a product (from product_interaction). */
  export async function getProductStats(productId: number): Promise<{ likes: number; views: number }> {
    const [likesRes, viewsRes] = await Promise.all([
      supabase
        .from('product_interaction')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId)
        .eq('interaction_type', 'like'),
      supabase
        .from('product_interaction')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId)
        .eq('interaction_type', 'view'),
    ])
    return {
      likes: likesRes.count ?? 0,
      views: viewsRes.count ?? 0,
    }
  }

  /** Record a view for this product (optional user). Idempotent: uses upsert+ignoreDuplicates to avoid 409 when view already exists. */
  export async function recordProductView(
    productId: number,
    userAccountId?: number
  ): Promise<void> {
    if (userAccountId == null) return
    const row = {
      user_account_id: userAccountId,
      product_id: productId,
      interaction_type: 'view',
    }
    const { error } = await supabase
      .from('product_interaction')
      .upsert(row, { onConflict: 'user_account_id,product_id,interaction_type', ignoreDuplicates: true })
    if (error) {
      const code = (error as { code?: string }).code
      if (code === '23505') return
      const { error: insertError } = await supabase.from('product_interaction').insert(row)
      if (insertError && (insertError as { code?: string }).code !== '23505') {
        console.error('recordProductView:', insertError)
      }
    }
  }

  /** Fetch related products (same category, same status, excluding productId). Limit 6. */
  export async function getRelatedProducts(
    productId: number,
    categorySlug: string,
    limit = 6
  ): Promise<ProductListingRow[]> {
    if (!categorySlug) return []
    const { data, error } = await supabase
      .from('product')
      .select(`
        id,
        name,
        price,
        status,
        design_data,
        user_account_id,
        created_at,
        product_category ( category_id, category ( id, name, slug ) ),
        user_account ( username ),
        product_variant ( id, price_override )
      `)
      .eq('status', 'active')
      .neq('id', productId)
      .order('created_at', { ascending: false })
      .limit(limit * 3)
    if (error) {
      console.error('getRelatedProducts:', error)
      return []
    }
    const rows = (data ?? []) as unknown as ProductListingRow[]
    const filtered = rows.filter((p) =>
      p.product_category?.some((pc) => pc.category?.slug === categorySlug)
    )
    return filtered.slice(0, limit)
  }

  // ---------------------------------------------------------------------------
  // Product likes (product_interaction type 'like')
  // ---------------------------------------------------------------------------

  /** Fetch product IDs that the user has liked. */
  export async function getLikedProductIds(userAccountId: number): Promise<number[]> {
    const { data, error } = await supabase
      .from('product_interaction')
      .select('product_id')
      .eq('user_account_id', userAccountId)
      .eq('interaction_type', 'like')

    if (error) {
      console.error('getLikedProductIds:', error)
      return []
    }
    return (data ?? []).map((r) => r.product_id)
  }

  /** Fetch full product rows for items the user has liked (for My Collection). */
  export async function getLikedProducts(userAccountId: number): Promise<ProductListingRow[]> {
    const { data, error } = await supabase
      .from('product_interaction')
      .select(
        `
        product_id,
        product (
          id,
          name,
          price,
          status,
          design_data,
          user_account_id,
          created_at,
          product_category ( category_id, category ( id, name, slug ) ),
          user_account ( username ),
          product_variant ( id, price_override )
        )
      `
      )
      .eq('user_account_id', userAccountId)
      .eq('interaction_type', 'like')

    if (error) {
      console.error('getLikedProducts:', error)
      return []
    }
    const rows = data ?? []
    const products = rows
      .map((r) => (r as { product: unknown }).product)
      .filter(Boolean) as ProductListingRow[]
    return products
  }

  /** Add a like (idempotent: already liked is ok). */
  export async function addProductLike(
    userAccountId: number,
    productId: number
  ): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('product_interaction').insert({
      user_account_id: userAccountId,
      product_id: productId,
      interaction_type: 'like',
    })
    if (error) {
      if (error.code === '23505') return { ok: true }
      console.error('addProductLike:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  }

  /** Remove a like. */
  export async function removeProductLike(
    userAccountId: number,
    productId: number
  ): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase
      .from('product_interaction')
      .delete()
      .eq('user_account_id', userAccountId)
      .eq('product_id', productId)
      .eq('interaction_type', 'like')
    if (error) {
      console.error('removeProductLike:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  }

  // ---------------------------------------------------------------------------
  // Product save (product_interaction type 'save') – 4.1.2 Save to Collection
  // ---------------------------------------------------------------------------

  /** Fetch product IDs the user has saved. */
  export async function getSavedProductIds(userAccountId: number): Promise<number[]> {
    const { data, error } = await supabase
      .from('product_interaction')
      .select('product_id')
      .eq('user_account_id', userAccountId)
      .eq('interaction_type', 'save')
    if (error) {
      console.error('getSavedProductIds:', error)
      return []
    }
    return (data ?? []).map((r) => r.product_id)
  }

  /** Fetch full product rows for items the user has saved (for My Collection page). */
  export async function getSavedProducts(userAccountId: number): Promise<ProductListingRow[]> {
    const { data, error } = await supabase
      .from('product_interaction')
      .select(
        `
        product_id,
        created_at,
        product (
          id,
          name,
          price,
          status,
          design_data,
          user_account_id,
          created_at,
          product_category ( category_id, category ( id, name, slug ) ),
          user_account ( username ),
          product_variant ( id, price_override )
        )
      `
      )
      .eq('user_account_id', userAccountId)
      .eq('interaction_type', 'save')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('getSavedProducts:', error)
      return []
    }
    const rows = data ?? []
    const products = rows
      .map((r) => (r as { product: unknown }).product)
      .filter(Boolean) as ProductListingRow[]
    return products
  }

  /** Add a save (idempotent). */
  export async function addProductSave(
    userAccountId: number,
    productId: number
  ): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('product_interaction').insert({
      user_account_id: userAccountId,
      product_id: productId,
      interaction_type: 'save',
    })
    if (error) {
      if (error.code === '23505') return { ok: true }
      console.error('addProductSave:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  }

  /** Remove a save. */
  export async function removeProductSave(
    userAccountId: number,
    productId: number
  ): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase
      .from('product_interaction')
      .delete()
      .eq('user_account_id', userAccountId)
      .eq('product_id', productId)
      .eq('interaction_type', 'save')
    if (error) {
      console.error('removeProductSave:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  }

  // ---------------------------------------------------------------------------
  // User follow (user_follow table)
  // ---------------------------------------------------------------------------

  /** Check if followerId is following followingId. */
  export async function isFollowing(
    followerId: number,
    followingId: number
  ): Promise<boolean> {
    if (followerId === followingId) return false
    const { data, error } = await supabase
      .from('user_follow')
      .select('follower_id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle()
    if (error) {
      console.error('isFollowing:', error)
      return false
    }
    return data != null
  }

  /** Follow a user. Idempotent (already following is ok). */
  export async function followUser(
    followerId: number,
    followingId: number
  ): Promise<{ error: Error | null }> {
    if (followerId === followingId) return { error: null }
    const { error } = await supabase.from('user_follow').insert({
      follower_id: followerId,
      following_id: followingId,
    })
    if (error) {
      if (error.code === '23505') return { error: null } // unique violation = already following
      console.error('followUser:', error)
      return { error }
    }
    return { error: null }
  }

  /** Unfollow a user. */
  export async function unfollowUser(
    followerId: number,
    followingId: number
  ): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('user_follow')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
    if (error) {
      console.error('unfollowUser:', error)
      return { error }
    }
    return { error: null }
  }

  /** Profile stats for a user (followers, following, products count, likes received on their products). */
  export type ProfileStats = {
    followers: number
    following: number
    products: number
    likesReceived: number
  }

  export async function getProfileStats(userAccountId: number): Promise<ProfileStats> {
    const [followersRes, followingRes, productsRes, productIdsRes] = await Promise.all([
      supabase.from('user_follow').select('follower_id', { count: 'exact', head: true }).eq('following_id', userAccountId),
      supabase.from('user_follow').select('following_id', { count: 'exact', head: true }).eq('follower_id', userAccountId),
      supabase.from('product').select('id', { count: 'exact', head: true }).eq('user_account_id', userAccountId),
      supabase.from('product').select('id').eq('user_account_id', userAccountId),
    ])

    const productIds = (productIdsRes.data ?? []).map((p) => p.id)
    let likesReceived = 0
    if (productIds.length > 0) {
      const { count } = await supabase
        .from('product_interaction')
        .select('id', { count: 'exact', head: true })
        .eq('interaction_type', 'like')
        .in('product_id', productIds)
      likesReceived = count ?? 0
    }

    return {
      followers: followersRes.count ?? 0,
      following: followingRes.count ?? 0,
      products: productsRes.count ?? 0,
      likesReceived,
    }
  }

  // ---------------------------------------------------------------------------
  // Notifications (user_notification table)
  // ---------------------------------------------------------------------------

  export type UserNotificationRow = {
    id: number
    user_account_id: number
    type: 'like' | 'follow'
    message: string
    link: string | null
    read: boolean
    created_at: string
  }

  /** Create a notification for a user (e.g. "Someone liked your product", "X started following you"). */
  export async function createNotification(
    recipientUserAccountId: number,
    type: 'like' | 'follow',
    message: string,
    link?: string | null
  ): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('user_notification').insert({
      user_account_id: recipientUserAccountId,
      type,
      message,
      link: link ?? null,
      read: false,
    })
    if (error) {
      console.error('createNotification:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  }

  /** Fetch notifications for the current user (newest first). */
  export async function getNotificationsForUser(
    userAccountId: number,
    limit = 50
  ): Promise<UserNotificationRow[]> {
    const { data, error } = await supabase
      .from('user_notification')
      .select('id, user_account_id, type, message, link, read, created_at')
      .eq('user_account_id', userAccountId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      console.error('getNotificationsForUser:', error)
      return []
    }
    return (data ?? []) as UserNotificationRow[]
  }

  /** Mark one notification as read. */
  export async function markNotificationRead(
    userAccountId: number,
    notificationId: number
  ): Promise<{ ok: boolean }> {
    const { error } = await supabase
      .from('user_notification')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_account_id', userAccountId)
    return { ok: !error }
  }

  /** Mark all notifications as read for the user. */
  export async function markAllNotificationsRead(
    userAccountId: number
  ): Promise<{ ok: boolean }> {
    const { error } = await supabase
      .from('user_notification')
      .update({ read: true })
      .eq('user_account_id', userAccountId)
    return { ok: !error }
  }

  // ---------------------------------------------------------------------------
  // Advertisements (banners)
  // ---------------------------------------------------------------------------

  export type AdvertisementRow = {
    id: number
    title: string
    image_url: string
    link_url: string | null
    is_active: boolean
    created_at: string
  }

  /** Fetch active advertisements for banners. */
  export async function getActiveAdvertisements(): Promise<AdvertisementRow[]> {
    const { data, error } = await supabase
      .from('advertisement')
      .select('id, title, image_url, link_url, is_active, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('getActiveAdvertisements:', error)
      return []
    }
    return (data ?? []) as AdvertisementRow[]
  }

  // ---------------------------------------------------------------------------
  // Cart (getOrCreateCart, addCartItem, list, update, remove, count)
  // ---------------------------------------------------------------------------

  /** Cart item row with product and variant info for display. */
  export type CartItemRow = {
    id: number
    cart_id: number
    product_variant_id: number
    quantity: number
    unit_price_at_added: number
    created_at: string
    updated_at: string | null
    /** Display label for variant when stored at add-to-cart (e.g. "Red" or "Red / M"). Requires cart_item.variant_label column. */
    variant_label?: string | null
    product_variant: {
      id: number
      price_override: number | null
      stripe_price_id: string | null
      product: {
        id: number
        name: string
        design_data: Record<string, unknown> | null
        user_account: { username: string } | null
      } | null
      product_variant_attribute_option: Array<{
        attribute_option: { label: string; attribute: { name: string } | null } | null
      }>
    } | null
  }

  /** Get or create cart for user; returns cart id or null. */
  export async function getOrCreateCart(userAccountId: number): Promise<{ id: number } | null> {
    const { data: existing } = await supabase
      .from('cart')
      .select('id')
      .eq('user_account_id', userAccountId)
      .maybeSingle()
    if (existing) return { id: existing.id }
    const { data: inserted, error } = await supabase
      .from('cart')
      .insert({ user_account_id: userAccountId })
      .select('id')
      .single()
    if (error) {
      console.error('getOrCreateCart:', error)
      return null
    }
    return inserted
  }

  /** Add item to cart (or update quantity if same variant already in cart). Pass variantLabel to store display text when product_variant_attribute_option is empty; requires cart_item.variant_label column. */
  export async function addCartItem(
    cartId: number,
    productVariantId: number,
    quantity: number,
    unitPriceAtAdded: number,
    variantLabel?: string | null
  ): Promise<{ id: number } | null> {
    const { data: existing } = await supabase
      .from('cart_item')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('product_variant_id', productVariantId)
      .maybeSingle()
    if (existing) {
      const { error: updateErr } = await supabase
        .from('cart_item')
        .update({ quantity: existing.quantity + quantity })
        .eq('id', existing.id)
      if (updateErr) {
        console.error('addCartItem update:', updateErr)
        return null
      }
      return { id: existing.id }
    }
    const insertPayload: Record<string, unknown> = {
      cart_id: cartId,
      product_variant_id: productVariantId,
      quantity,
      unit_price_at_added: unitPriceAtAdded,
    }
    // When cart_item.variant_label column exists, uncomment to store label for single-variant products:
    // if (variantLabel != null && String(variantLabel).trim() !== '') {
    //   insertPayload.variant_label = String(variantLabel).trim()
    // }
    const { data: inserted, error } = await supabase
      .from('cart_item')
      .insert(insertPayload)
      .select('id')
      .single()
    if (error) {
      console.error('addCartItem insert:', error)
      return null
    }
    return inserted
  }

  /** List cart items with product and variant (attribute labels) for display.
   * After adding cart_item.variant_label (see scripts/add_cart_item_variant_label.sql),
   * add "variant_label," to the select list below. */
  export async function getCartItems(cartId: number, client?: typeof supabase): Promise<CartItemRow[]> {
    const db = client ?? supabase
    const { data, error } = await db
      .from('cart_item')
      .select(`
        id,
        cart_id,
        product_variant_id,
        quantity,
        unit_price_at_added,
        created_at,
        updated_at,
        product_variant (
          id,
          price_override,
          stripe_price_id,
          product (
            id,
            name,
            design_data,
            user_account ( username )
          ),
          product_variant_attribute_option (
            attribute_option ( label, attribute ( name ) )
          )
        )
      `)
      .eq('cart_id', cartId)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('getCartItems:', error)
      return []
    }
    return (data ?? []) as unknown as CartItemRow[]
  }

  /** Update cart item quantity (min 1). */
  export async function updateCartItemQuantity(
    cartItemId: number,
    quantity: number
  ): Promise<boolean> {
    const q = Math.max(1, quantity)
    const { error } = await supabase
      .from('cart_item')
      .update({ quantity: q })
      .eq('id', cartItemId)
    if (error) {
      console.error('updateCartItemQuantity:', error)
      return false
    }
    return true
  }

  /** Remove item from cart. */
  export async function removeCartItem(cartItemId: number): Promise<boolean> {
    const { error } = await supabase.from('cart_item').delete().eq('id', cartItemId)
    if (error) {
      console.error('removeCartItem:', error)
      return false
    }
    return true
  }

  /** Total number of items (sum of quantity) in user's cart for badge. */
  export async function getCartItemCount(userAccountId: number): Promise<number> {
    const { data: cart } = await supabase
      .from('cart')
      .select('id')
      .eq('user_account_id', userAccountId)
      .maybeSingle()
    if (!cart) return 0
    const { data: rows, error } = await supabase
      .from('cart_item')
      .select('quantity')
      .eq('cart_id', cart.id)
    if (error) return 0
    const total = (rows ?? []).reduce((sum, r) => sum + r.quantity, 0)
    return total
  }

  // ---------------------------------------------------------------------------
  // Design drafts (Stepweave AI Design Tool)
  // ---------------------------------------------------------------------------

  export type DesignDraftStatus = 'draft' | 'finalized' | 'archived'
  export type DesignDraftPatternSourceType =
    | 'ai_generated'
    | 'reference_transform'
    | 'direct_upload'
  export type LlmMessageRole = 'system' | 'user' | 'assistant' | 'tool'

  /** Row from design_draft (snake_case as returned by Supabase). */
  export type DesignDraftRow = {
    id: number
    user_account_id: number
    name: string | null
    base_model_provider: string
    base_model_id: string
    structural_color: string
    fabric_color: string | null
    design_state: Record<string, unknown>
    preview_image_url: string | null
    pattern_source_type: DesignDraftPatternSourceType
    pattern_image_url: string | null
    generation_variation_count: number
    status: DesignDraftStatus
    finalized_at: string | null
    final_product_id: number | null
    created_at: string
    updated_at: string
  }

  /** Row from design_draft_ai_message. */
  export type DesignDraftAiMessageRow = {
    id: number
    design_draft_id: number
    message_index: number
    role: LlmMessageRole
    content: Record<string, unknown>
    created_at: string
  }

  /** Payload to create a new design_draft. */
  export type CreateDesignDraftPayload = {
    base_model_id: string
    base_model_provider?: string
    structural_color?: 'white' | 'black'
    pattern_source_type: DesignDraftPatternSourceType
    pattern_image_url?: string | null
    generation_variation_count?: number
    design_state?: Record<string, unknown>
    name?: string | null
    fabric_color?: string | null
  }

  /** Payload to update an existing design_draft (partial). */
  export type UpdateDesignDraftPayload = {
    name?: string | null
    structural_color?: 'white' | 'black'
    fabric_color?: string | null
    design_state?: Record<string, unknown>
    preview_image_url?: string | null
    pattern_image_url?: string | null
    generation_variation_count?: number
    status?: DesignDraftStatus
    final_product_id?: number | null
    finalized_at?: string | null
  }

  /** Single message to insert into design_draft_ai_message. */
  export type DesignDraftAiMessageInsert = {
    role: LlmMessageRole
    content: Record<string, unknown>
  }

  /** Create a new design draft. RLS: design_draft_insert_own. */
  export async function createDesignDraft(
    userAccountId: number,
    payload: CreateDesignDraftPayload
  ): Promise<{ id: number } | null> {
    const { data, error } = await supabase
      .from('design_draft')
      .insert({
        user_account_id: userAccountId,
        base_model_id: payload.base_model_id,
        base_model_provider: payload.base_model_provider ?? 'printful',
        structural_color: payload.structural_color ?? 'white',
        pattern_source_type: payload.pattern_source_type,
        pattern_image_url: payload.pattern_image_url ?? null,
        generation_variation_count: payload.generation_variation_count ?? 3,
        design_state: payload.design_state ?? {},
        name: payload.name ?? null,
        fabric_color: payload.fabric_color ?? null,
      })
      .select('id')
      .single()
    if (error) {
      console.error('createDesignDraft:', error)
      return null
    }
    return data ? { id: data.id as number } : null
  }

  /** List drafts for the current user. RLS: design_draft_select_own. */
  export async function getDesignDraftsByUser(
    userAccountId: number,
    options?: { status?: DesignDraftStatus; limit?: number }
  ): Promise<DesignDraftRow[]> {
    let q = supabase
      .from('design_draft')
      .select('*')
      .eq('user_account_id', userAccountId)
      .order('updated_at', { ascending: false })
    if (options?.status) q = q.eq('status', options.status)
    if (options?.limit) q = q.limit(options.limit)
    const { data, error } = await q
    if (error) {
      console.error('getDesignDraftsByUser:', error)
      return []
    }
    return (data ?? []) as DesignDraftRow[]
  }

  /** Get a single draft by id. RLS: design_draft_select_own. */
  export async function getDesignDraftById(
    draftId: number
  ): Promise<DesignDraftRow | null> {
    const { data, error } = await supabase
      .from('design_draft')
      .select('*')
      .eq('id', draftId)
      .maybeSingle()
    if (error) {
      console.error('getDesignDraftById:', error)
      return null
    }
    return data as DesignDraftRow | null
  }

  /** Update a design draft. RLS: design_draft_update_own. */
  export async function updateDesignDraft(
    draftId: number,
    payload: UpdateDesignDraftPayload
  ): Promise<boolean> {
    const row: Record<string, unknown> = {}
    if (payload.name !== undefined) row.name = payload.name
    if (payload.structural_color !== undefined)
      row.structural_color = payload.structural_color
    if (payload.fabric_color !== undefined) row.fabric_color = payload.fabric_color
    if (payload.design_state !== undefined) row.design_state = payload.design_state
    if (payload.preview_image_url !== undefined)
      row.preview_image_url = payload.preview_image_url
    if (payload.pattern_image_url !== undefined)
      row.pattern_image_url = payload.pattern_image_url
    if (payload.generation_variation_count !== undefined)
      row.generation_variation_count = payload.generation_variation_count
    if (payload.status !== undefined) row.status = payload.status
    if (payload.final_product_id !== undefined)
      row.final_product_id = payload.final_product_id
    if (payload.finalized_at !== undefined)
      row.finalized_at = payload.finalized_at
    if (Object.keys(row).length === 0) return true
    const { error } = await supabase.from('design_draft').update(row).eq('id', draftId)
    if (error) {
      console.error('updateDesignDraft:', error)
      return false
    }
    return true
  }

  /** Insert AI messages for a draft (e.g. LLM conversation history). RLS: design_draft_ai_message_insert_own. */
  export async function insertDesignDraftAiMessages(
    designDraftId: number,
    messages: DesignDraftAiMessageInsert[]
  ): Promise<boolean> {
    if (messages.length === 0) return true
    const rows = messages.map((msg, i) => ({
      design_draft_id: designDraftId,
      message_index: i,
      role: msg.role,
      content: msg.content,
    }))
    const { error } = await supabase
      .from('design_draft_ai_message')
      .insert(rows)
    if (error) {
      console.error('insertDesignDraftAiMessages:', error)
      return false
    }
    return true
  }

  /** Get all AI messages for a draft, ordered by message_index. RLS: design_draft_ai_message_select_own. */
  export async function getDesignDraftAiMessages(
    designDraftId: number
  ): Promise<DesignDraftAiMessageRow[]> {
    const { data, error } = await supabase
      .from('design_draft_ai_message')
      .select('*')
      .eq('design_draft_id', designDraftId)
      .order('message_index', { ascending: true })
    if (error) {
      console.error('getDesignDraftAiMessages:', error)
      return []
    }
    return (data ?? []) as DesignDraftAiMessageRow[]
  }

  // ---------------------------------------------------------------------------
  // Type definitions for database tables (Template Database Design)
  // ---------------------------------------------------------------------------

export type Database = {
    public: {
      Tables: {
        user_account: {
          Row: {
            id: number
            auth_user_id: string
            username: string
            avatar_url: string | null
            bio: string | null
            role: 'admin' | 'user'
            subscription_tier: 'free' | 'starter' | 'pro'
            created_at: string
            updated_at: string | null
          }
          Insert: {
            id?: number
            auth_user_id: string
            username: string
            avatar_url?: string | null
            bio?: string | null
            role?: 'admin' | 'user'
            subscription_tier?: 'free' | 'starter' | 'pro'
            created_at?: string
            updated_at?: string | null
          }
          Update: {
            id?: number
            auth_user_id?: string
            username?: string
            avatar_url?: string | null
            bio?: string | null
            role?: 'admin' | 'user'
            subscription_tier?: 'free' | 'starter' | 'pro'
            created_at?: string
            updated_at?: string | null
          }
        }
                user_public_profile: {
          Row: {
            user_account_id: number
            username: string
            avatar_url: string | null
            bio: string | null
            updated_at: string
          }
          Insert: {
            user_account_id: number
            username: string
            avatar_url?: string | null
            bio?: string | null
            updated_at?: string
          }
          Update: {
            user_account_id?: number
            username?: string
            avatar_url?: string | null
            bio?: string | null
            updated_at?: string
          }
        }
        product: {
          Row: {
            id: number
            name: string
            price: number
            status: 'draft' | 'active' | 'archived'
            design_data: Record<string, unknown> | null
            user_account_id: number
            stripe_product_id: string | null
            created_at: string
          }
          Insert: {
            id?: number
            name: string
            price?: number
            status?: 'draft' | 'active' | 'archived'
            design_data?: Record<string, unknown> | null
            user_account_id: number
            stripe_product_id?: string | null
            created_at?: string
          }
          Update: {
            id?: number
            name?: string
            price?: number
            status?: 'draft' | 'active' | 'archived'
            design_data?: Record<string, unknown> | null
            user_account_id?: number
            stripe_product_id?: string | null
            created_at?: string
          }
        }
        product_variant: {
          Row: {
            id: number
            product_id: number
            price_override: number | null
            status: 'active' | 'archived'
            stripe_price_id: string | null
            created_at: string
            updated_at: string | null
          }
          Insert: {
            id?: number
            product_id: number
            price_override?: number | null
            status?: 'active' | 'archived'
            stripe_price_id?: string | null
            created_at?: string
            updated_at?: string | null
          }
          Update: {
            id?: number
            product_id?: number
            price_override?: number | null
            status?: 'active' | 'archived'
            stripe_price_id?: string | null
            created_at?: string
            updated_at?: string | null
          }
        }
        product_variant_attribute_option: {
          Row: {
            product_variant_id: number
            attribute_option_id: number
            created_at: string
          }
          Insert: {
            product_variant_id: number
            attribute_option_id: number
            created_at?: string
          }
          Update: {
            product_variant_id?: number
            attribute_option_id?: number
            created_at?: string
          }
        }
        category: {
          Row: {
            id: number
            name: string
            slug: string
            parent_id: number | null
            created_at: string
          }
          Insert: {
            id?: number
            name: string
            slug: string
            parent_id?: number | null
            created_at?: string
          }
          Update: {
            id?: number
            name?: string
            slug?: string
            parent_id?: number | null
            created_at?: string
          }
        }
        attribute: {
          Row: {
            id: number
            name: string
            slug: string
            created_at: string
          }
          Insert: {
            id?: number
            name: string
            slug: string
            created_at?: string
          }
          Update: {
            id?: number
            name?: string
            slug?: string
            created_at?: string
          }
        }
        attribute_option: {
          Row: {
            id: number
            attribute_id: number
            label: string
            slug: string | null
            sort_order: number
            created_at: string
          }
          Insert: {
            id?: number
            attribute_id: number
            label: string
            slug?: string | null
            sort_order?: number
            created_at?: string
          }
          Update: {
            id?: number
            attribute_id?: number
            label?: string
            slug?: string | null
            sort_order?: number
            created_at?: string
          }
        }
        product_category: {
          Row: {
            product_id: number
            category_id: number
            created_at: string
          }
          Insert: {
            product_id: number
            category_id: number
            created_at?: string
          }
          Update: {
            product_id?: number
            category_id?: number
            created_at?: string
          }
        }
        product_attribute_option: {
          Row: {
            product_id: number
            attribute_option_id: number
            created_at: string
          }
          Insert: {
            product_id: number
            attribute_option_id: number
            created_at?: string
          }
          Update: {
            product_id?: number
            attribute_option_id?: number
            created_at?: string
          }
        }
        cart: {
          Row: {
            id: number
            user_account_id: number
            created_at: string
            updated_at: string | null
          }
          Insert: {
            id?: number
            user_account_id: number
            created_at?: string
            updated_at?: string | null
          }
          Update: {
            id?: number
            user_account_id?: number
            created_at?: string
            updated_at?: string | null
          }
        }
        cart_item: {
          Row: {
            id: number
            cart_id: number
            product_variant_id: number
            quantity: number
            unit_price_at_added: number
            created_at: string
            updated_at: string | null
          }
          Insert: {
            id?: number
            cart_id: number
            product_variant_id: number
            quantity?: number
            unit_price_at_added: number
            created_at?: string
            updated_at?: string | null
          }
          Update: {
            id?: number
            cart_id?: number
            product_variant_id?: number
            quantity?: number
            unit_price_at_added?: number
            created_at?: string
            updated_at?: string | null
          }
        }
        user_order: {
          Row: {
            id: number
            user_account_id: number
            total_amount: number
            currency: string
            stripe_checkout_session_id: string | null
            stripe_payment_intent_id: string | null
            stripe_customer_id: string | null
            payment_method: string | null
            status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled'
            paid_at: string | null
            created_at: string
            updated_at: string | null
            shipping_address: ShippingAddressRow | null
          }
          Insert: {
            id?: number
            user_account_id: number
            total_amount?: number
            currency?: string
            stripe_checkout_session_id?: string | null
            stripe_payment_intent_id?: string | null
            stripe_customer_id?: string | null
            payment_method?: string | null
            status?: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled'
            paid_at?: string | null
            created_at?: string
            updated_at?: string | null
            shipping_address?: ShippingAddressRow | null
          }
          Update: {
            id?: number
            user_account_id?: number
            total_amount?: number
            currency?: string
            stripe_checkout_session_id?: string | null
            stripe_payment_intent_id?: string | null
            stripe_customer_id?: string | null
            payment_method?: string | null
            status?: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled'
            paid_at?: string | null
            created_at?: string
            updated_at?: string | null
            shipping_address?: ShippingAddressRow | null
          }
        }
        order_item: {
          Row: {
            id: number
            order_id: number
            product_id: number
            product_variant_id: number
            product_name: string
            variant_label: string | null
            quantity: number
            unit_price: number
            subtotal: number
            stripe_price_id: string | null
            created_at: string
          }
          Insert: {
            id?: number
            order_id: number
            product_id: number
            product_variant_id: number
            product_name: string
            variant_label?: string | null
            quantity?: number
            unit_price: number
            subtotal?: number
            stripe_price_id?: string | null
            created_at?: string
          }
          Update: {
            id?: number
            order_id?: number
            product_id?: number
            product_variant_id?: number
            product_name?: string
            variant_label?: string | null
            quantity?: number
            unit_price?: number
            subtotal?: number
            stripe_price_id?: string | null
            created_at?: string
          }
        }
        product_interaction: {
          Row: {
            id: number
            user_account_id: number
            product_id: number
            interaction_type: 'view' | 'like' | 'download'
            created_at: string
          }
          Insert: {
            id?: number
            user_account_id: number
            product_id: number
            interaction_type: 'view' | 'like' | 'download'
            created_at?: string
          }
          Update: {
            id?: number
            user_account_id?: number
            product_id?: number
            interaction_type?: 'view' | 'like' | 'download'
            created_at?: string
          }
        }
        user_follow: {
          Row: {
            follower_id: number
            following_id: number
            created_at: string
          }
          Insert: {
            follower_id: number
            following_id: number
            created_at?: string
          }
          Update: {
            follower_id?: number
            following_id?: number
            created_at?: string
          }
        }
        advertisement: {
          Row: {
            id: number
            title: string
            image_url: string
            link_url: string | null
            is_active: boolean
            created_at: string
            updated_at: string | null
          }
          Insert: {
            id?: number
            title: string
            image_url: string
            link_url?: string | null
            is_active?: boolean
            created_at?: string
            updated_at?: string | null
          }
          Update: {
            id?: number
            title?: string
            image_url?: string
            link_url?: string | null
            is_active?: boolean
            created_at?: string
            updated_at?: string | null
          }

        }
        // Optional / toggleable modules (feature flags control UI/backend access)
        newsletter_subscriber: {
            Row: {
              id: number
              email: string
              status: 'active' | 'unsubscribed'
              created_at: string
              unsubscribed_at: string | null
            }
            Insert: {
              id?: number
              email: string
              status?: 'active' | 'unsubscribed'
              created_at?: string
              unsubscribed_at?: string | null
            }
            Update: {
              id?: number
              email?: string
              status?: 'active' | 'unsubscribed'
              created_at?: string
              unsubscribed_at?: string | null
            }
          }
          newsletter_issue: {
            Row: {
              id: number
              title: string
              slug: string
              content: string
              published_at: string | null
              created_at: string
            }
            Insert: {
              id?: number
              title: string
              slug: string
              content: string
              published_at?: string | null
              created_at?: string
            }
            Update: {
              id?: number
              title?: string
              slug?: string
              content?: string
              published_at?: string | null
              created_at?: string
            }
          }
          article: {
            Row: {
              id: number
              title: string
              slug: string
              content: string
              summary: string | null
              seo_title: string | null
              seo_description: string | null
              status: 'draft' | 'published' | 'archived'
              author_user_account_id: number | null
              published_at: string | null
              created_at: string
              updated_at: string | null
            }
            Insert: {
              id?: number
              title: string
              slug: string
              content: string
              summary?: string | null
              seo_title?: string | null
              seo_description?: string | null
              status?: 'draft' | 'published' | 'archived'
              author_user_account_id?: number | null
              published_at?: string | null
              created_at?: string
              updated_at?: string | null
            }
            Update: {
              id?: number
              title?: string
              slug?: string
              content?: string
              summary?: string | null
              seo_title?: string | null
              seo_description?: string | null
              status?: 'draft' | 'published' | 'archived'
              author_user_account_id?: number | null
              published_at?: string | null
              created_at?: string
              updated_at?: string | null
            }
          }
          contact_submission: {
            Row: {
              id: number
              name: string | null
              email: string
              subject: string | null
              message: string
              status: 'new' | 'open' | 'closed'
              assigned_admin_user_account_id: number | null
              created_at: string
              responded_at: string | null
            }
            Insert: {
              id?: number
              name?: string | null
              email: string
              subject?: string | null
              message: string
              status?: 'new' | 'open' | 'closed'
              assigned_admin_user_account_id?: number | null
              created_at?: string
              responded_at?: string | null
            }
            Update: {
              id?: number
              name?: string | null
              email?: string
              subject?: string | null
              message?: string
              status?: 'new' | 'open' | 'closed'
              assigned_admin_user_account_id?: number | null
              created_at?: string
              responded_at?: string | null
            }
          }
          user_subscription: {
            Row: {
              id: number
              user_account_id: number
              provider: string
              stripe_customer_id: string | null
              stripe_subscription_id: string | null
              status: 'active' | 'past_due' | 'canceled'
              current_period_end_at: string | null
              created_at: string
              updated_at: string | null
            }
            Insert: {
              id?: number
              user_account_id: number
              provider?: string
              stripe_customer_id?: string | null
              stripe_subscription_id?: string | null
              status?: 'active' | 'past_due' | 'canceled'
              current_period_end_at?: string | null
              created_at?: string
              updated_at?: string | null
            }
            Update: {
              id?: number
              user_account_id?: number
              provider?: string
              stripe_customer_id?: string | null
              stripe_subscription_id?: string | null
              status?: 'active' | 'past_due' | 'canceled'
              current_period_end_at?: string | null
              created_at?: string
              updated_at?: string | null
            }
          }
      }
    }
  }