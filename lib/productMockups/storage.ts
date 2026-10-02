import type { SupabaseClient } from '@supabase/supabase-js'

export const MOCKUP_BUCKET = 'design-patterns'
/** Signed URLs for storefront / design-tool preview display */
export const MOCKUP_SIGNED_URL_EXPIRES_SEC = 3600

export type StoredMockupExtra = {
  title: string
  mockup_path?: string
  /** Legacy Printful temp URL — not persisted on new saves */
  mockup_url?: string
  /** Canonical camera view ('top' | 'left' | 'right' | 'back' | 'front' | 'branding') */
  view?: string
}

export type StoredMockupPlacement = {
  placement: string
  label: string
  mockup_path?: string
  mockup_url?: string
  /** Canonical camera view of the main mockup */
  view?: string
  extra_mockups?: StoredMockupExtra[]
  /** Which gender these mockup images were generated for. Absence = mens (legacy). */
  gender?: 'mens' | 'womens'
}

/** Placement row with resolved `mockup_url` for display (signed or legacy http). */
export type ResolvedMockupPlacement = StoredMockupPlacement & {
  mockup_url: string
  extra_mockups?: Array<{ title: string; mockup_url: string; view?: string }>
}

function slugSegment(value: string): string {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return s || 'view'
}

export function mockupStoragePath(
  authUserId: string,
  draftId: number,
  placement: string,
  label: string,
  extraTitle?: string,
  /** Optional subdirectory inside …/mockups/, e.g. 'womens' */
  subdir?: string
): string {
  const base = subdir?.trim()
    ? `${authUserId}/${draftId}/mockups/${slugSegment(subdir)}`
    : `${authUserId}/${draftId}/mockups`
  if (extraTitle?.trim()) {
    return `${base}/${slugSegment(placement)}--extra--${slugSegment(extraTitle)}.png`
  }
  return `${base}/${slugSegment(placement)}--${slugSegment(label)}.png`
}

export function isExternalPrintfulMockupUrl(url: string): boolean {
  const u = url.trim().toLowerCase()
  if (!u.startsWith('http')) return false
  // Printful CDN hosts change; keep this broad so we still persist mockups.
  return (
    u.includes('printful') ||
    u.includes('/tmp/') ||
    u.includes('amazonaws.com') ||
    u.includes('cloudfront.net')
  )
}

/** True when a placement row has a displayable main URL or any extra mockup URL. */
export function mockupPlacementHasDisplayUrl(p: {
  mockup_url?: string | null
  extra_mockups?: Array<{ mockup_url?: string | null }> | null
}): boolean {
  if (typeof p.mockup_url === 'string' && p.mockup_url.trim()) return true
  return (p.extra_mockups ?? []).some(
    (e) => typeof e.mockup_url === 'string' && Boolean(e.mockup_url.trim())
  )
}

/** Count of displayable image URLs across main + extras (for API/client diagnostics). */
export function countMockupDisplayUrls(
  placements: Array<{
    mockup_url?: string | null
    extra_mockups?: Array<{ mockup_url?: string | null }> | null
  }>
): number {
  let n = 0
  for (const p of placements) {
    if (typeof p.mockup_url === 'string' && p.mockup_url.trim()) n++
    for (const e of p.extra_mockups ?? []) {
      if (typeof e.mockup_url === 'string' && e.mockup_url.trim()) n++
    }
  }
  return n
}

export function isMockupStoragePath(value: string): boolean {
  const v = value.trim()
  if (!v || v.startsWith('http')) return false
  return v.includes('/mockups/')
}

/**
 * Rows safe to persist: storage paths only, no expiring Printful URLs.
 */
export function mockupPlacementsForDatabase(
  placements: StoredMockupPlacement[]
): StoredMockupPlacement[] {
  return placements.map((p) => {
    const row: StoredMockupPlacement = {
      placement: p.placement,
      label: p.label,
    }
    if (p.mockup_path?.trim()) row.mockup_path = p.mockup_path.trim()
    if (p.view?.trim()) row.view = p.view.trim()
    if (p.gender) row.gender = p.gender
    const extras = (p.extra_mockups ?? [])
      .map((ex) => {
        const extra: StoredMockupExtra = { title: ex.title }
        if (ex.mockup_path?.trim()) extra.mockup_path = ex.mockup_path.trim()
        if (ex.view?.trim()) extra.view = ex.view.trim()
        return extra
      })
      .filter((ex) => ex.mockup_path)
    if (extras.length) row.extra_mockups = extras
    return row
  })
}

export async function downloadAndUploadMockup(
  admin: SupabaseClient,
  params: {
    authUserId: string
    draftId: number
    placement: string
    label: string
    extraTitle?: string
    sourceUrl: string
    storageSubdir?: string
  }
): Promise<{ path: string } | null> {
  const sourceUrl = params.sourceUrl.trim()
  if (!sourceUrl) return null

  let imageRes: Response
  try {
    imageRes = await fetch(sourceUrl)
  } catch (e) {
    console.error('[mockup-storage] fetch', e)
    return null
  }
  if (!imageRes.ok) {
    console.error('[mockup-storage] fetch status', imageRes.status, sourceUrl.slice(0, 120))
    return null
  }

  const buffer = Buffer.from(await imageRes.arrayBuffer())
  const path = mockupStoragePath(
    params.authUserId,
    params.draftId,
    params.placement,
    params.label,
    params.extraTitle,
    params.storageSubdir
  )

  const { error: uploadErr } = await admin.storage.from(MOCKUP_BUCKET).upload(path, buffer, {
    contentType: 'image/png',
    upsert: true,
  })
  if (uploadErr) {
    console.error('[mockup-storage] upload', uploadErr.message, path)
    return null
  }
  return { path }
}

/**
 * Download Printful temp mockups and store under design-patterns/{userId}/{draftId}/mockups/.
 * Printful sometimes serves the same image URL under several placements — those
 * are stored once and the path is reused, so galleries can dedupe by URL.
 */
export async function persistPrintfulMockupsToStorage(
  admin: SupabaseClient,
  authUserId: string,
  draftId: number,
  placements: StoredMockupPlacement[],
  options?: { storageSubdir?: string }
): Promise<StoredMockupPlacement[]> {
  const stored: StoredMockupPlacement[] = []
  const pathBySourceUrl = new Map<string, string>()

  const uploadOnce = async (params: {
    placement: string
    label: string
    extraTitle?: string
    sourceUrl: string
  }): Promise<string | null> => {
    const existing = pathBySourceUrl.get(params.sourceUrl)
    if (existing) return existing
    const uploaded = await downloadAndUploadMockup(admin, {
      authUserId,
      draftId,
      storageSubdir: options?.storageSubdir,
      ...params,
    })
    if (!uploaded) return null
    pathBySourceUrl.set(params.sourceUrl, uploaded.path)
    return uploaded.path
  }

  for (const p of placements) {
    const row: StoredMockupPlacement = {
      placement: p.placement,
      label: p.label,
      ...(p.view?.trim() ? { view: p.view.trim() } : {}),
      ...(p.gender ? { gender: p.gender } : {}),
    }

    const mainUrl = p.mockup_url?.trim() ?? ''
    if (p.mockup_path?.trim()) {
      row.mockup_path = p.mockup_path.trim()
    } else if (mainUrl && isExternalPrintfulMockupUrl(mainUrl)) {
      const path = await uploadOnce({
        placement: p.placement,
        label: p.label,
        sourceUrl: mainUrl,
      })
      if (path) row.mockup_path = path
    } else if (mainUrl && isMockupStoragePath(mainUrl)) {
      row.mockup_path = mainUrl
    }

    const extras: StoredMockupExtra[] = []
    for (const ex of p.extra_mockups ?? []) {
      const extraRow: StoredMockupExtra = {
        title: ex.title,
        ...(ex.view?.trim() ? { view: ex.view.trim() } : {}),
      }
      const exUrl = ex.mockup_url?.trim() ?? ''
      if (ex.mockup_path?.trim()) {
        extraRow.mockup_path = ex.mockup_path.trim()
      } else if (exUrl && isExternalPrintfulMockupUrl(exUrl)) {
        const path = await uploadOnce({
          placement: p.placement,
          label: p.label,
          extraTitle: ex.title,
          sourceUrl: exUrl,
        })
        if (path) extraRow.mockup_path = path
      } else if (exUrl && isMockupStoragePath(exUrl)) {
        extraRow.mockup_path = exUrl
      }
      if (extraRow.mockup_path) extras.push(extraRow)
    }
    if (extras.length) row.extra_mockups = extras

    stored.push(row)
  }

  return stored
}

export async function resolveMockupPlacementsForDisplay(
  admin: SupabaseClient,
  placements: StoredMockupPlacement[],
  expiresInSec = MOCKUP_SIGNED_URL_EXPIRES_SEC
): Promise<ResolvedMockupPlacement[]> {
  const pathsToSign = new Set<string>()

  for (const p of placements) {
    if (p.mockup_path?.trim()) pathsToSign.add(p.mockup_path.trim())
    for (const ex of p.extra_mockups ?? []) {
      if (ex.mockup_path?.trim()) pathsToSign.add(ex.mockup_path.trim())
    }
  }

  const signedByPath = new Map<string, string>()
  if (pathsToSign.size > 0) {
    // Zip by request index — some supabase-js versions omit `entry.path` on success.
    const paths = Array.from(pathsToSign)
    const { data: signed, error } = await admin.storage
      .from(MOCKUP_BUCKET)
      .createSignedUrls(paths, expiresInSec)
    if (error || !signed) {
      console.error('[mockup-storage] createSignedUrls', error?.message)
    } else {
      for (let i = 0; i < paths.length; i++) {
        const entry = signed[i]
        const url = entry?.signedUrl?.trim()
        if (!url) continue
        signedByPath.set(paths[i], url)
        if (entry.path?.trim() && entry.path.trim() !== paths[i]) {
          signedByPath.set(entry.path.trim(), url)
        }
      }
    }
  }

  const resolved: ResolvedMockupPlacement[] = []

  for (const p of placements) {
    let displayUrl = ''
    if (p.mockup_path?.trim()) {
      displayUrl = signedByPath.get(p.mockup_path.trim()) ?? ''
    }
    if (!displayUrl && p.mockup_url?.trim()) {
      const legacy = p.mockup_url.trim()
      if (legacy.startsWith('http')) displayUrl = legacy
    }

    const extras: Array<{ title: string; mockup_url: string; view?: string }> = []
    for (const ex of p.extra_mockups ?? []) {
      let exUrl = ''
      if (ex.mockup_path?.trim()) {
        exUrl = signedByPath.get(ex.mockup_path.trim()) ?? ''
      }
      if (!exUrl && ex.mockup_url?.trim()?.startsWith('http')) {
        exUrl = ex.mockup_url.trim()
      }
      if (exUrl) {
        extras.push({
          title: ex.title,
          mockup_url: exUrl,
          ...(ex.view?.trim() ? { view: ex.view.trim() } : {}),
        })
      }
    }

    resolved.push({
      placement: p.placement,
      label: p.label,
      mockup_path: p.mockup_path,
      mockup_url: displayUrl,
      ...(p.view?.trim() ? { view: p.view.trim() } : {}),
      ...(p.gender ? { gender: p.gender } : {}),
      ...(extras.length ? { extra_mockups: extras } : {}),
    })
  }

  return resolved
}
