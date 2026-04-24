import { createClient } from '@supabase/supabase-js'
import type { DesignDraftSnapshotPayload } from '@/lib/supabaseClient'

/**
 * Load the linked design_draft for an active marketplace product (final_product_id)
 * using the service role. Used at checkout so buyers can purchase POD listings without
 * owning the draft (RLS would block anon/user client reads of the creator's draft).
 */
export async function resolveDesignSnapshotForProductCheckout(
  productId: number
): Promise<{ draftId: number; snapshot: DesignDraftSnapshotPayload } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceKey) {
    console.error('[resolveDesignSnapshotForProduct] Missing SUPABASE_SERVICE_ROLE_KEY')
    return null
  }

  const admin = createClient(url, serviceKey)

  const { data: product, error: productError } = await admin
    .from('product')
    .select('id, status, design_data')
    .eq('id', productId)
    .maybeSingle()

  if (productError || !product) {
    if (productError) console.error('[resolveDesignSnapshotForProduct] product', productError)
    return null
  }

  if (String(product.status) !== 'active') {
    return null
  }

  const dd = product.design_data as Record<string, unknown> | null
  if (!dd || dd.source !== 'design_draft') {
    return null
  }

  const { data: draft, error: draftError } = await admin
    .from('design_draft')
    .select('id, design_state, pattern_image_url, base_model_id, structural_color')
    .eq('final_product_id', productId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (draftError || !draft) {
    if (draftError) console.error('[resolveDesignSnapshotForProduct] draft', draftError)
    return null
  }

  const raw = draft.design_state
  const design_state =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  const bm = draft.base_model_id
  const base_model_id =
    typeof bm === 'string' ? bm : bm != null && typeof bm === 'number' ? String(bm) : ''

  if (!base_model_id) {
    console.warn('[resolveDesignSnapshotForProduct] draft missing base_model_id', draft.id)
    return null
  }

  const snapshot: DesignDraftSnapshotPayload = {
    design_state,
    pattern_image_url: draft.pattern_image_url ?? null,
    base_model_id,
    structural_color:
      typeof draft.structural_color === 'string' && draft.structural_color.trim()
        ? draft.structural_color
        : 'white',
    captured_at: new Date().toISOString(),
  }

  return { draftId: draft.id as number, snapshot }
}
