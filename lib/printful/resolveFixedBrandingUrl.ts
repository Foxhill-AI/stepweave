/**
 * Resolve a branding image URL that Printful's servers can fetch.
 * Localhost SITE_URL is unreachable by Printful — we upload a print-sized PNG
 * to Storage and prefer a Printful File Library preview URL when available.
 */

import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getFixedBrandingAbsoluteUrl,
  STEPWEAVE_BRANDING_PUBLIC_PATH,
} from '@/lib/printful/fixedBranding'
import { PRINTFUL_BASE } from '@/lib/printful/mockupTask'

const BUCKET = 'design-patterns'
const STORAGE_PATH = 'system/branding/branding-rect-stacked-print.png'
const SIGNED_URL_SEC = 7200
/** label_inside printfile on Athletic Shoes is 1050×600 @ 150dpi. */
const PRINT_WIDTH = 1050
const PRINT_HEIGHT = 600

function isUnreachableForPrintful(absoluteUrl: string): boolean {
  try {
    const host = new URL(absoluteUrl).hostname.toLowerCase()
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local')
    )
  } catch {
    return true
  }
}

async function buildPrintSizedPng(): Promise<Buffer | null> {
  const localFile = path.join(
    process.cwd(),
    'public',
    ...STEPWEAVE_BRANDING_PUBLIC_PATH.replace(/^\//, '').split('/')
  )
  if (!fs.existsSync(localFile)) {
    console.warn('[fixedBranding] asset missing on disk:', localFile)
    return null
  }
  return sharp(localFile)
    .resize(PRINT_WIDTH, PRINT_HEIGHT, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

type PrintfulFileRow = {
  id?: number
  status?: string
  url?: string
  preview_url?: string
  message?: string
}

async function printfulHostedPreviewUrl(signedSourceUrl: string): Promise<string | null> {
  const apiKey = process.env.PRINTFUL_API_KEY?.trim()
  const storeId = process.env.PRINTFUL_STORE_ID?.trim()
  if (!apiKey) return null

  const headers: HeadersInit = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  if (storeId) headers['X-PF-Store-Id'] = storeId

  try {
    const createRes = await fetch(`${PRINTFUL_BASE}/files`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: signedSourceUrl,
        filename: 'stepweave-branding.png',
      }),
    })
    if (!createRes.ok) {
      console.warn('[fixedBranding] Printful /files', createRes.status, (await createRes.text()).slice(0, 200))
      return null
    }
    let file = ((await createRes.json()) as { result?: PrintfulFileRow }).result
    if (!file?.id) return null

    for (let i = 0; i < 20 && file.status !== 'ok'; i++) {
      await new Promise((r) => setTimeout(r, 1500))
      const pollRes: Response = await fetch(`${PRINTFUL_BASE}/files/${file.id}`, { headers })
      if (!pollRes.ok) break
      file = ((await pollRes.json()) as { result?: PrintfulFileRow }).result ?? file
    }

    if (file.status === 'ok' && file.preview_url?.trim()) {
      return file.preview_url.trim()
    }
  } catch (err) {
    console.warn('[fixedBranding] Printful file library error', err)
  }
  return null
}

/**
 * Prefer a public site URL; otherwise Storage (+ optional Printful CDN preview).
 */
export async function resolveFixedBrandingUrlForPrintful(
  admin: SupabaseClient
): Promise<string | null> {
  const fromSite = getFixedBrandingAbsoluteUrl()
  if (fromSite && !isUnreachableForPrintful(fromSite)) {
    return fromSite
  }

  const buf = await buildPrintSizedPng()
  if (!buf) return fromSite

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(STORAGE_PATH, buf, {
    contentType: 'image/png',
    upsert: true,
  })
  if (uploadError) {
    console.error('[fixedBranding] storage upload failed:', uploadError.message)
    return fromSite
  }

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrls([STORAGE_PATH], SIGNED_URL_SEC)
  const signedUrl = signed?.[0]?.signedUrl
  if (signError || !signedUrl) {
    console.error('[fixedBranding] sign failed:', signError?.message ?? 'no url')
    return fromSite
  }

  const printfulUrl = await printfulHostedPreviewUrl(signedUrl)
  return printfulUrl || signedUrl
}
