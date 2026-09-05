import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  countMockupDisplayUrls,
  mockupPlacementHasDisplayUrl,
  resolveMockupPlacementsForDisplay,
  type StoredMockupPlacement,
} from '@/lib/productMockups/storage'

/**
 * GET /api/design-drafts/[id]/mockups
 * Resolved mockup placements for the design-tool preview (same signing path as storefront).
 * Owner-only. Used when the preview POST response has empty display URLs but mockups were persisted.
 */
export async function GET(
  _request: NextRequest,
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: draft, error: draftError } = await supabase
    .from('design_draft')
    .select('id, user_account_id, mockup_urls')
    .eq('id', draftId)
    .maybeSingle()

  if (draftError || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  const { data: userAccount } = await supabase
    .from('user_account')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()

  if (!userAccount || (draft.user_account_id as number) !== userAccount.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const rawPlacements = (Array.isArray(draft.mockup_urls) ? draft.mockup_urls : []) as StoredMockupPlacement[]
  if (rawPlacements.length === 0) {
    return NextResponse.json({
      placements: [],
      display_url_count: 0,
      mockups_persisted: false,
    })
  }

  const resolved = await resolveMockupPlacementsForDisplay(admin, rawPlacements)
  const placements = resolved
    .filter(mockupPlacementHasDisplayUrl)
    .map((p) => ({
      placement: p.placement,
      label: p.label,
      mockup_url: p.mockup_url,
      ...(p.view ? { view: p.view } : {}),
      ...(p.extra_mockups?.length ? { extra_mockups: p.extra_mockups } : {}),
    }))

  const displayUrlCount = countMockupDisplayUrls(placements)
  return NextResponse.json({
    placements,
    display_url_count: displayUrlCount,
    mockups_persisted: displayUrlCount > 0,
  })
}
