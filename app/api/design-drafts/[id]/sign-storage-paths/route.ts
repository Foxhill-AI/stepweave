import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const BUCKET = 'design-patterns'
const SIGNED_URL_EXPIRES_IN = 3600

/**
 * POST /api/design-drafts/[id]/sign-storage-paths
 * Batch signed URLs for `design-patterns` paths owned by this draft (same prefix rule as placement-images).
 *
 * Body: { paths: string[] }
 * Returns: { urls: Record<string, string> } path → signedUrl
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { paths?: unknown } | null
  const rawPaths = body?.paths
  if (!Array.isArray(rawPaths) || rawPaths.length === 0) {
    return NextResponse.json({ urls: {} })
  }

  const expectedPrefix = `${authUser.id}/${draftId}/`
  const paths: string[] = []
  for (const p of rawPaths) {
    if (typeof p !== 'string' || !p.trim()) continue
    const path = p.trim()
    if (!path.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: `Path is not authorized for this draft: ${path}` },
        { status: 403 }
      )
    }
    paths.push(path)
  }

  const uniquePaths = Array.from(new Set(paths))
  if (uniquePaths.length === 0) {
    return NextResponse.json({ urls: {} })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(uniquePaths, SIGNED_URL_EXPIRES_IN)

  if (signError || !signed) {
    console.error('[sign-storage-paths] createSignedUrls:', signError?.message)
    return NextResponse.json({ error: 'Could not generate image URLs' }, { status: 500 })
  }

  const urls: Record<string, string> = {}
  for (const entry of signed) {
    if (entry.signedUrl && entry.path) urls[entry.path] = entry.signedUrl
  }

  return NextResponse.json({ urls })
}
