import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  mockupPlacementsForDatabase,
  persistPrintfulMockupsToStorage,
  type StoredMockupPlacement,
} from '@/lib/productMockups/storage'

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
    .select('id, user_account_id, mockup_urls, base_model_id, structural_color')
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

  // Fetch Printful variants for the base model to create per-size product variants.
  const baseModelId = typeof draft.base_model_id === 'string' ? draft.base_model_id.trim() : ''
  const structuralColor = typeof draft.structural_color === 'string' ? draft.structural_color.trim().toLowerCase() : 'white'
  const printfulApiKey = process.env.PRINTFUL_API_KEY?.trim()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  type PFVariant = { id: number; size: string; color: string }
  let sizeVariants: PFVariant[] = []
  let modelName: string | null = null

  if (baseModelId && printfulApiKey) {
    try {
      const pfRes = await fetch(`https://api.printful.com/products/${encodeURIComponent(baseModelId)}`, {
        headers: { Authorization: `Bearer ${printfulApiKey}`, 'Content-Type': 'application/json' },
      })
      if (pfRes.ok) {
        const pfData = await pfRes.json() as { result?: { product?: { title?: string; model?: string }; variants?: Array<{ id: number; size?: string; color?: string }> } }
        modelName = pfData.result?.product?.title ?? pfData.result?.product?.model ?? null
        const all = pfData.result?.variants ?? []
        const colorFiltered = all.filter((v) => (v.color ?? '').toLowerCase().includes(structuralColor))
        const source = colorFiltered.length > 0 ? colorFiltered : all
        const seenSizes = new Set<string>()
        for (const v of source) {
          const sz = (v.size ?? '').trim()
          if (!sz || seenSizes.has(sz)) continue
          seenSizes.add(sz)
          sizeVariants.push({ id: v.id, size: sz, color: (v.color ?? '').trim() })
        }
      }
    } catch { /* fall through to single variant */ }
  }

  const { data: product, error: productError } = await supabase
    .from('product')
    .insert({
      user_account_id: userAccountId,
      name,
      price,
      status: 'active',
      design_data: {
        source: 'design_draft',
        base_model_id: baseModelId || undefined,
        structural_color: structuralColor,
        model_name: modelName || undefined,
      },
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

  // Create per-size variants using service role (attribute tables need elevated access).
  const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : supabase

  if (sizeVariants.length > 0) {
    // Get or create "Size" attribute.
    let sizeAttributeId: number | null = null
    const { data: existingAttr } = await admin.from('attribute').select('id').eq('slug', 'size').maybeSingle()
    if (existingAttr?.id) {
      sizeAttributeId = existingAttr.id as number
    } else {
      const { data: newAttr } = await admin.from('attribute').insert({ name: 'Size', slug: 'size' }).select('id').single()
      sizeAttributeId = (newAttr?.id as number) ?? null
    }

    if (sizeAttributeId) {
      for (const sv of sizeVariants) {
        // Get or create attribute_option for this size label.
        let optionId: number | null = null
        const { data: existingOpt } = await admin.from('attribute_option')
          .select('id').eq('attribute_id', sizeAttributeId).eq('label', sv.size).maybeSingle()
        if (existingOpt?.id) {
          optionId = existingOpt.id as number
        } else {
          const { data: newOpt } = await admin.from('attribute_option')
            .insert({ attribute_id: sizeAttributeId, label: sv.size }).select('id').single()
          optionId = (newOpt?.id as number) ?? null
        }
        if (!optionId) continue

        // Create product_variant with printful_variant_id for fulfillment lookup.
        const { data: pv } = await admin.from('product_variant').insert({
          product_id: productId,
          status: 'active',
          price_override: null,
          printful_variant_id: sv.id,
        }).select('id').single()
        if (!pv?.id) continue

        // Link variant → size option.
        await admin.from('product_variant_attribute_option').insert({
          product_variant_id: pv.id,
          attribute_option_id: optionId,
        })
      }
    } else {
      // attribute creation failed — fall back to one generic variant
      await admin.from('product_variant').insert({ product_id: productId, status: 'active', price_override: null })
    }
  } else {
    // No Printful variant data — create one generic variant.
    const { error: variantError } = await supabase.from('product_variant').insert({
      product_id: productId,
      status: 'active',
      price_override: null,
    })
    if (variantError) {
      console.error('[create-product] product_variant insert:', variantError)
      return NextResponse.json({ error: 'Failed to create product variant' }, { status: 500 })
    }
  }

  let mockupList = draft?.mockup_urls
  const hasMockups = Array.isArray(mockupList) && mockupList.length > 0

  // Migrate any remaining Printful /tmp URLs to Supabase storage before publish.
  if (hasMockups && authUser.id && supabaseUrl && serviceRoleKey) {
    const stored = await persistPrintfulMockupsToStorage(
      admin,
      authUser.id,
      draftId,
      mockupList as StoredMockupPlacement[]
    )
    const hasStoredPath = stored.some(
      (p) =>
        p.mockup_path?.trim() ||
        (p.extra_mockups ?? []).some((e) => e.mockup_path?.trim())
    )
    if (hasStoredPath) {
      mockupList = mockupPlacementsForDatabase(stored)
    }
  }

  const { error: updateError } = await supabase
    .from('design_draft')
    .update({
      final_product_id: productId,
      status: 'finalized',
      finalized_at: new Date().toISOString(),
      // Bless existing previews for this new product row (same instant as product.updated_at).
      mockups_generated_at: hasMockups ? new Date().toISOString() : null,
      ...(Array.isArray(mockupList) ? { mockup_urls: mockupList } : {}),
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
