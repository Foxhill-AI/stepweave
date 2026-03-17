import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * POST /api/design-drafts/[id]/create-product
 * Creates a product from the draft and links it via design_draft.final_product_id.
 * Body: { name: string, price: number, categoryId?: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const draftId = Number(id)
  if (Number.isNaN(draftId)) {
    return NextResponse.json({ error: 'Invalid draft id' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !authUser) {
    return NextResponse.json(
      { error: 'You must be signed in to create a product' },
      { status: 401 }
    )
  }

  const { data: userAccount } = await supabase
    .from('user_account')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()
  if (!userAccount?.id) {
    return NextResponse.json({ error: 'User account not found' }, { status: 403 })
  }
  const userAccountId = userAccount.id as number

  const { data: draft, error: draftError } = await supabase
    .from('design_draft')
    .select('id, user_account_id')
    .eq('id', draftId)
    .maybeSingle()
  if (draftError || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }
  if ((draft.user_account_id as number) !== userAccountId) {
    return NextResponse.json({ error: 'Not allowed to use this draft' }, { status: 403 })
  }

  let body: { name?: string; price?: number; categoryId?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const price = Number(body.price)
  const categoryId = typeof body.categoryId === 'number' && body.categoryId > 0 ? body.categoryId : null
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (Number.isNaN(price) || price < 0) {
    return NextResponse.json({ error: 'Valid price is required' }, { status: 400 })
  }

  const { data: product, error: productError } = await supabase
    .from('product')
    .insert({
      user_account_id: userAccountId,
      name,
      price,
      status: 'active',
      design_data: { source: 'design_draft' },
    })
    .select('id')
    .single()
  if (productError || !product) {
    console.error('[create-product] product insert:', productError)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
  const productId = product.id as number

  if (categoryId) {
    await supabase.from('product_category').insert({
      product_id: productId,
      category_id: categoryId,
    })
  }

  const { error: variantError } = await supabase.from('product_variant').insert({
    product_id: productId,
    status: 'active',
    price_override: null,
  })
  if (variantError) {
    console.error('[create-product] product_variant insert:', variantError)
    return NextResponse.json(
      { error: 'Failed to create product variant' },
      { status: 500 }
    )
  }

  const { error: updateError } = await supabase
    .from('design_draft')
    .update({
      final_product_id: productId,
      status: 'finalized',
      finalized_at: new Date().toISOString(),
    })
    .eq('id', draftId)
  if (updateError) {
    console.error('[create-product] design_draft update:', updateError)
    return NextResponse.json(
      { error: 'Failed to link draft to product' },
      { status: 500 }
    )
  }

  return NextResponse.json({ productId })
}
