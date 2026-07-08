import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const BUCKET = 'design-patterns'
const MAX_SIZE_BYTES = 10 * 1024 * 1024

/**
 * POST /api/design-drafts/[id]/reference-image
 * Accepts JSON { fileName, contentType, fileSize }.
 * Returns { signedUrl, storagePath } — the client uploads directly to Supabase Storage
 * using a PUT to signedUrl, bypassing Vercel's 4.5 MB body limit.
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
    return NextResponse.json({ error: 'You must be signed in' }, { status: 401 })
  }

  const { data: draft, error: draftError } = await supabase
    .from('design_draft')
    .select('id, user_account_id')
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
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  let body: { fileName?: string; contentType?: string; fileSize?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { fileName, contentType, fileSize } = body
  if (!fileName || !contentType) {
    return NextResponse.json({ error: 'fileName and contentType are required' }, { status: 400 })
  }
  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }
  if (typeof fileSize === 'number' && fileSize > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: `Image must be under ${MAX_SIZE_BYTES / 1024 / 1024} MB` }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const dotIdx = fileName.lastIndexOf('.')
  const ext = dotIdx >= 0 ? fileName.slice(dotIdx) : '.png'
  const storagePath = `${authUser.id}/${draftId}/reference-${Date.now()}${ext}`

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: signedData, error: signedError } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath)

  if (signedError || !signedData?.signedUrl) {
    console.error('[reference-image] signed URL error', signedError?.message)
    return NextResponse.json({ error: 'Could not create upload URL. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: signedData.signedUrl, storagePath })
}
