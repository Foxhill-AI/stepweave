import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const BUCKET = 'design-patterns'
const SIGNED_URL_EXPIRES_IN = 3600 // 1 hour

/**
 * GET /api/design-drafts/[id]/pattern-image
 * Returns a signed URL for the draft's pattern image (private bucket).
 * Requires auth and draft ownership.
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
    return NextResponse.json(
      { error: 'You must be signed in to view this image' },
      { status: 401 }
    )
  }

  const { data: draft, error: draftError } = await supabase
    .from('design_draft')
    .select('user_account_id, pattern_image_url')
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
    return NextResponse.json({ error: 'Not allowed to view this draft' }, { status: 403 })
  }

  const path = draft.pattern_image_url
  if (!path || typeof path !== 'string' || path.trim() === '') {
    return NextResponse.json({ error: 'No pattern image for this draft' }, { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[pattern-image] Missing SUPABASE_SERVICE_ROLE_KEY or URL')
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrls([path], SIGNED_URL_EXPIRES_IN)

  if (signError || !signed?.length || !signed[0]?.signedUrl) {
    console.error('[pattern-image] createSignedUrls:', signError?.message ?? 'no url')
    return NextResponse.json(
      { error: 'Could not generate image URL' },
      { status: 500 }
    )
  }

  return NextResponse.json({ url: signed[0].signedUrl })
}
