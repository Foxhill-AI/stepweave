import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  mockupPlacementsForDatabase,
  persistPrintfulMockupsToStorage,
  type StoredMockupPlacement,
} from '@/lib/productMockups/storage'
import { getModelPricing, getUnifiedModelPricingByEitherId } from '@/lib/printful/modelPricing'

/**
 * POST /api/design-drafts/[id]/create-product
 * Creates a product from the draft and links it via design_draft.final_product_id.
 * Creates variants for BOTH mens and womens sizes (gender × size matrix).
 * Fires a background request to generate womens mockups after returning.
 * Body: { name: string, categoryId?: number }
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

  let body: { name?: string; categoryId?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const categoryId = typeof body.categoryId === 'number' && body.categoryId > 0 ? body.categoryId : null
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const baseModelId = typeof draft.base_model_id === 'string' ? draft.base_model_id.trim() : ''
  const structuralColor = typeof draft.structural_color === 'string' ? draft.structural_color.trim().toLowerCase() : 'white'

  // Look up fixed price from platform config.
  const modelPricing = getModelPricing(baseModelId)
  if (!modelPricing) {
    return NextResponse.json(
      { error: 'This shoe model does not have a configured price. Please contact support.' },
      { status: 422 }
    )
  }
  const price = modelPricing.fixedPrice
  const baseCost = modelPricing.baseCosts

  // Get unified pricing to find the womens partner product ID.
  const unifiedPricing = getUnifiedModelPricingByEitherId(baseModelId)
  const productIdWomens = unifiedPricing?.productIdWomens ?? null

  const printfulApiKey = process.env.PRINTFUL_API_KEY?.trim()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  type PFVariant = { id: number; size: string; color: string }

  // Fetch mens and womens Printful variants in parallel.
  let sizeVariantsMens: PFVariant[] = []
  let sizeVariantsWomens: PFVariant[] = []
  let modelName: string | null = null

  const extractVariants = (
    pfData: { result?: { product?: { title?: string; model?: string }; variants?: Array<{ id: number; size?: string; color?: string }> } },
    captureModelName: boolean
  ): PFVariant[] => {
    if (captureModelName) {
      modelName = pfData.result?.product?.title ?? pfData.result?.product?.model ?? null
    }
    const all = pfData.result?.variants ?? []
    const colorFiltered = all.filter((v) => (v.color ?? '').toLowerCase().includes(structuralColor))
    const source = colorFiltered.length > 0 ? colorFiltered : all
    const seenSizes = new Set<string>()
    const result: PFVariant[] = []
    for (const v of source) {
      const sz = (v.size ?? '').trim()
      if (!sz || seenSizes.has(sz)) continue
      seenSizes.add(sz)
      result.push({ id: v.id, size: sz, color: (v.color ?? '').trim() })
    }
    return result
  }

  if (baseModelId && printfulApiKey) {
    try {
      const fetches: Promise<Response>[] = [
        fetch(`https://api.printful.com/products/${encodeURIComponent(baseModelId)}`, {
          headers: { Authorization: `Bearer ${printfulApiKey}`, 'Content-Type': 'application/json' },
        }),
      ]
      if (productIdWomens) {
        fetches.push(
          fetch(`https://api.printful.com/products/${encodeURIComponent(productIdWomens)}`, {
            headers: { Authorization: `Bearer ${printfulApiKey}`, 'Content-Type': 'application/json' },
          })
        )
      }

      const responses = await Promise.all(fetches)
      const [mensRes, womensRes] = responses

      if (mensRes.ok) {
        const pfData = await mensRes.json() as Parameters<typeof extractVariants>[0]
        sizeVariantsMens = extractVariants(pfData, true)
      }
      if (womensRes?.ok) {
        const pfData = await womensRes.json() as Parameters<typeof extractVariants>[0]
        sizeVariantsWomens = extractVariants(pfData, false)
      }
    } catch { /* fall through to single generic variant */ }
  }

  const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : supabase

  const { data: product, error: productError } = await supabase
    .from('product')
    .insert({
      user_account_id: userAccountId,
      name,
      price,
      base_cost: baseCost,
      status: 'active',
      design_data: {
        source: 'design_draft',
        base_model_id: baseModelId || undefined,
        product_id_womens: productIdWomens || undefined,
        structural_color: structuralColor,
        model_name: unifiedPricing?.name ?? modelName ?? undefined,
      },
    })
    .select('id')
    .single()
  if (productError || !product) {
    console.error('[create-product] product insert:', productError)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
  const productId = product.id as number

  if (categoryId) {
    await supabase.from('product_category').insert({
      product_id: productId,
      category_id: categoryId,
    })
  }

  const hasVariants = sizeVariantsMens.length > 0 || sizeVariantsWomens.length > 0

  if (hasVariants) {
    // Get or create "Size" attribute.
    let sizeAttributeId: number | null = null
    const { data: existingAttr } = await admin.from('attribute').select('id').eq('slug', 'size').maybeSingle()
    if (existingAttr?.id) {
      sizeAttributeId = existingAttr.id as number
    } else {
      const { data: newAttr } = await admin.from('attribute').insert({ name: 'Size', slug: 'size' }).select('id').single()
      sizeAttributeId = (newAttr?.id as number) ?? null
    }

    // Get gender attribute and its Men's / Women's option IDs.
    let mensGenderOptionId: number | null = null
    let womensGenderOptionId: number | null = null
    const { data: genderAttr } = await admin.from('attribute').select('id').eq('slug', 'gender').maybeSingle()
    if (genderAttr?.id) {
      const genderAttrId = genderAttr.id as number
      const { data: genderOptions } = await admin
        .from('attribute_option')
        .select('id, label')
        .eq('attribute_id', genderAttrId)
        .in('label', ["Men's", "Women's"])
      for (const opt of genderOptions ?? []) {
        if (opt.label === "Men's") mensGenderOptionId = opt.id as number
        if (opt.label === "Women's") womensGenderOptionId = opt.id as number
      }
    }

    if (sizeAttributeId) {
      // Cache size option IDs to avoid repeated lookups for the same size label.
      const sizeOptionCache = new Map<string, number>()
      const getSizeOptionId = async (sizeLabel: string): Promise<number | null> => {
        const cached = sizeOptionCache.get(sizeLabel)
        if (cached != null) return cached
        const { data: existingOpt } = await admin
          .from('attribute_option')
          .select('id')
          .eq('attribute_id', sizeAttributeId!)
          .eq('label', sizeLabel)
          .maybeSingle()
        if (existingOpt?.id) {
          sizeOptionCache.set(sizeLabel, existingOpt.id as number)
          return existingOpt.id as number
        }
        const { data: newOpt } = await admin
          .from('attribute_option')
          .insert({ attribute_id: sizeAttributeId!, label: sizeLabel })
          .select('id')
          .single()
        const optId = (newOpt?.id as number) ?? null
        if (optId) sizeOptionCache.set(sizeLabel, optId)
        return optId
      }

      // Create variants for each gender × size combination.
      const variantSets: Array<{ variants: PFVariant[]; genderOptionId: number | null }> = [
        { variants: sizeVariantsMens, genderOptionId: mensGenderOptionId },
        { variants: sizeVariantsWomens, genderOptionId: womensGenderOptionId },
      ]

      for (const { variants, genderOptionId } of variantSets) {
        for (const sv of variants) {
          const sizeOptionId = await getSizeOptionId(sv.size)
          if (!sizeOptionId) continue

          const { data: pv } = await admin.from('product_variant').insert({
            product_id: productId,
            status: 'active',
            price_override: null,
            printful_variant_id: sv.id,
          }).select('id').single()
          if (!pv?.id) continue

          // Link size option.
          await admin.from('product_variant_attribute_option').insert({
            product_variant_id: pv.id,
            attribute_option_id: sizeOptionId,
          })

          // Link gender option (if available).
          if (genderOptionId) {
            await admin.from('product_variant_attribute_option').insert({
              product_variant_id: pv.id,
              attribute_option_id: genderOptionId,
            })
          }
        }
      }
    } else {
      // Size attribute creation failed — fall back to one generic variant.
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
      mockups_generated_at: hasMockups ? new Date().toISOString() : null,
      ...(Array.isArray(mockupList) ? { mockup_urls: mockupList } : {}),
    })
    .eq('id', draftId)
  if (updateError) {
    console.error('[create-product] design_draft update:', updateError)
    return NextResponse.json({ error: 'Failed to link draft to product' }, { status: 500 })
  }

  // Fire-and-forget: generate womens mockups in the background.
  // The response is returned immediately; this runs asynchronously on Vercel.
  if (productIdWomens && process.env.INTERNAL_API_SECRET) {
    const origin = (request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    fetch(`${origin}/api/design-drafts/${draftId}/generate-womens-mockups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.INTERNAL_API_SECRET,
      },
      signal: AbortSignal.timeout(3000),
    }).catch(() => {}) // intentional fire-and-forget
  }

  return NextResponse.json({ productId })
}
