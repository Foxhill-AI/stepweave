import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const BUCKET = 'design-patterns'
const SIGNED_URL_EXPIRES_IN = 3600 // 1 hour

/**
 * POST /api/design-drafts/[id]/placement-images
 * Signs storage paths for per-placement image layers.
 *
 * Body:   { paths: Record<string, Record<string, string>> }  placement → layerId → storagePath
 * Returns { urls:  Record<string, Record<string, string>> }  placement → layerId → signedUrl
 *
 * Each path must start with `{authUserId}/{draftId}/` to prove ownership.
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

  const body = (await request.json().catch(() => null)) as {
    paths?: Record<string, Record<string, string>>
  } | null

  const pathsByPlacement = body?.paths
  if (!pathsByPlacement || typeof pathsByPlacement !== 'object' || Object.keys(pathsByPlacement).length === 0) {
    return NextResponse.json({ urls: {} })
  }

  // Flatten and verify all paths
  const expectedPrefix = `${authUser.id}/${draftId}/`
  const allPaths: Array<{ placement: string; layerId: string; path: string }> = []

  for (const [placement, layerMap] of Object.entries(pathsByPlacement)) {
    if (!layerMap || typeof layerMap !== 'object') continue
    for (const [layerId, path] of Object.entries(layerMap)) {
      if (typeof path !== 'string' || !path.startsWith(expectedPrefix)) {
        return NextResponse.json(
          { error: `Path for placement "${placement}" layer "${layerId}" is not authorized` },
          { status: 403 }
        )
      }
      allPaths.push({ placement, layerId, path })
    }
  }

  if (allPaths.length === 0) return NextResponse.json({ urls: {} })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const uniquePaths = Array.from(new Set(allPaths.map((p) => p.path)))
  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(uniquePaths, SIGNED_URL_EXPIRES_IN)

  if (signError || !signed) {
    console.error('[placement-images] createSignedUrls:', signError?.message)
    return NextResponse.json({ error: 'Could not generate image URLs' }, { status: 500 })
  }

  const signedByPath = new Map<string, string>()
  for (const entry of signed) {
    if (entry.signedUrl && entry.path) signedByPath.set(entry.path, entry.signedUrl)
  }

  const urls: Record<string, Record<string, string>> = {}
  for (const { placement, layerId, path } of allPaths) {
    const url = signedByPath.get(path)
    if (url) {
      if (!urls[placement]) urls[placement] = {}
      urls[placement][layerId] = url
    }
  }

  return NextResponse.json({ urls })
}
