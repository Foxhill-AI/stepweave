/**
 * Smoke-test fixed Step Weave branding against Printful Mockup Generator.
 * Usage: node --env-file=.env.local scripts/smoke-fixed-branding.mjs
 *
 * Does not print secrets. Prints placement keys, branding URL host, and mockup result.
 */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const PRINTFUL_BASE = 'https://api.printful.com'
const BUCKET = 'design-patterns'
const STORAGE_PATH = 'system/branding/branding-rect-stacked-print.png'
const LOCAL_ASSET = path.join(root, 'public', 'branding', 'branding-rect-stacked.png')

function isBrandingPlacement(placement) {
  const t = String(placement).toLowerCase().replace(/_/g, ' ').trim()
  if (!t) return false
  if (t.includes('brand')) return true
  if (t === 'label' || t.includes('label inside')) return true
  return false
}

function isLocalHost(url) {
  try {
    const h = new URL(url).hostname.toLowerCase()
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.endsWith('.local')
  } catch {
    return true
  }
}

function urlHost(url) {
  try {
    return new URL(url).hostname
  } catch {
    return '(invalid)'
  }
}

async function resolveBrandingUrl(admin) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '')
  const siteUrl = site ? `${site}/branding/branding-rect-stacked.png` : null
  if (siteUrl && !isLocalHost(siteUrl)) {
    return { url: siteUrl, source: 'site' }
  }

  if (!fs.existsSync(LOCAL_ASSET)) {
    throw new Error(`Missing local asset: ${LOCAL_ASSET}`)
  }

  // Prefer an already-optimized print PNG when present; else raw asset.
  const printAsset = path.join(root, 'public', 'branding', 'branding-rect-stacked-print.png')
  const uploadBuf = fs.existsSync(printAsset)
    ? fs.readFileSync(printAsset)
    : fs.readFileSync(LOCAL_ASSET)

  const { error: upErr } = await admin.storage.from(BUCKET).upload(STORAGE_PATH, uploadBuf, {
    contentType: 'image/png',
    upsert: true,
  })
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`)

  const { data, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrls([STORAGE_PATH], 7200)
  if (signErr || !data?.[0]?.signedUrl) {
    throw new Error(`Sign failed: ${signErr?.message ?? 'no url'}`)
  }
  const signedUrl = data[0].signedUrl

  // Printful File Library → CDN preview (more reliable than raw signed Storage URLs)
  const apiKey = process.env.PRINTFUL_API_KEY.trim()
  const storeId = process.env.PRINTFUL_STORE_ID.trim()
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-PF-Store-Id': storeId,
  }
  const createFile = await fetch(`${PRINTFUL_BASE}/files`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url: signedUrl, filename: 'stepweave-branding.png' }),
  })
  if (createFile.ok) {
    let file = (await createFile.json()).result
    for (let i = 0; i < 20 && file?.status !== 'ok'; i++) {
      await sleep(1500)
      file = (await (await fetch(`${PRINTFUL_BASE}/files/${file.id}`, { headers })).json()).result
    }
    if (file?.status === 'ok' && file.preview_url) {
      return { url: file.preview_url, source: 'printful-cdn' }
    }
  }

  return { url: signedUrl, source: 'supabase-signed' }
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const apiKey = process.env.PRINTFUL_API_KEY?.trim()
  const storeId = process.env.PRINTFUL_STORE_ID?.trim()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!apiKey || !storeId) throw new Error('PRINTFUL_API_KEY / PRINTFUL_STORE_ID required')
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase URL / service role required')

  // 1) Local asset
  const assetStat = fs.statSync(LOCAL_ASSET)
  console.log('asset_ok', { bytes: assetStat.size, path: 'public/branding/branding-rect-stacked.png' })

  // 2) Branding URL Printful can fetch
  const admin = createClient(supabaseUrl, serviceKey)
  const branding = await resolveBrandingUrl(admin)
  console.log('branding_url', { source: branding.source, host: urlHost(branding.url) })

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-PF-Store-Id': storeId,
  }

  // 3) Use the same shoe list the design tool uses
  const appRes = await fetch('http://localhost:3000/api/printful/products')
  if (!appRes.ok) throw new Error(`app products ${appRes.status}`)
  const appJson = await appRes.json()
  const products = appJson.products ?? []
  if (!products.length) throw new Error('No shoe products from /api/printful/products')

  let chosen = null
  for (const p of products) {
    const id = String(p.id)
    const [prodRes, pfRes] = await Promise.all([
      fetch(`${PRINTFUL_BASE}/products/${id}`, { headers }),
      fetch(`${PRINTFUL_BASE}/mockup-generator/printfiles/${id}`, { headers }),
    ])
    if (!prodRes.ok || !pfRes.ok) continue
    const prod = (await prodRes.json()).result ?? {}
    const pf = (await pfRes.json()).result ?? {}
    const available = pf.available_placements ?? {}
    const brandingKeys = Object.keys(available).filter(isBrandingPlacement)
    if (brandingKeys.length === 0) continue

    const variants = prod.variants ?? []
    const variantId = variants[0]?.id
    if (!variantId) continue
    const mapping = (pf.variant_printfiles ?? []).find((vp) => vp.variant_id === variantId)
    if (!mapping?.placements) continue
    const brandingOnVariant = brandingKeys.filter((k) => k in mapping.placements)
    if (brandingOnVariant.length === 0) continue

    chosen = {
      productId: id,
      title: p.name || prod.title || id,
      variantId,
      brandingKeys: brandingOnVariant,
      printfiles: pf,
      mapping,
      available,
    }
    break
  }

  if (!chosen) {
    console.log('FAIL: no shoe product with branding/label placement found')
    process.exit(1)
  }

  console.log('product', {
    id: chosen.productId,
    title: chosen.title,
    variantId: chosen.variantId,
    brandingKeys: chosen.brandingKeys,
  })

  const printfileById = new Map()
  for (const pf of chosen.printfiles.printfiles ?? []) {
    if (typeof pf.printfile_id === 'number') {
      printfileById.set(pf.printfile_id, { width: pf.width, height: pf.height })
    }
  }

  const placeholder =
    process.env.PRINTFUL_PLACEHOLDER_IMAGE_URL?.trim() ||
    'https://files.cdn.printful.com/upload/product-catalog-img/b7/b7427e7543b29d4f52a8bd5e4d80c946_l'

  // Printful requires non-branding placements as well for these shoes.
  const placementKeys = Object.keys(chosen.mapping.placements).filter(
    (k) => k in chosen.available
  )

  const files = placementKeys.map((placement) => {
    const pid = chosen.mapping.placements[placement]
    const dims = printfileById.get(pid) ?? { width: 1800, height: 1800 }
    const w = dims.width
    const h = dims.height
    const useBranding = isBrandingPlacement(placement)
    return {
      placement,
      image_url: useBranding ? branding.url : placeholder,
      position: {
        area_width: w,
        area_height: h,
        width: w,
        height: h,
        top: 0,
        left: 0,
      },
    }
  })

  console.log('create_task', {
    fileCount: files.length,
    placements: files.map((f) => f.placement),
    brandingFiles: files.filter((f) => isBrandingPlacement(f.placement)).length,
  })

  const createRes = await fetch(`${PRINTFUL_BASE}/mockup-generator/create-task/${chosen.productId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      variant_ids: [chosen.variantId],
      format: 'png',
      files,
    }),
  })
  const createText = await createRes.text()
  if (!createRes.ok) {
    console.log('FAIL create-task', createRes.status, createText.slice(0, 400))
    process.exit(1)
  }
  let taskKey
  try {
    taskKey = JSON.parse(createText)?.result?.task_key
  } catch {
    /* ignore */
  }
  if (!taskKey) {
    console.log('FAIL: no task_key', createText.slice(0, 400))
    process.exit(1)
  }
  console.log('task_key', taskKey)

  let mockups = []
  for (let i = 0; i < 30; i++) {
    await sleep(i === 0 ? 8000 : 3000)
    const pollRes = await fetch(
      `${PRINTFUL_BASE}/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`,
      { headers }
    )
    const pollJson = await pollRes.json()
    const status = pollJson?.result?.status
    console.log('poll', { i, status })
    if (status === 'completed') {
      mockups = pollJson.result.mockups ?? []
      break
    }
    if (status === 'failed') {
      console.log('FAIL task', JSON.stringify(pollJson.result).slice(0, 500))
      process.exit(1)
    }
  }

  const brandingMockups = mockups.filter((m) => isBrandingPlacement(m.placement))
  const withUrl = brandingMockups.filter((m) => Boolean(m.mockup_url))
  console.log('result', {
    totalMockups: mockups.length,
    brandingMockups: brandingMockups.length,
    brandingWithUrl: withUrl.length,
    sampleUrlHost: withUrl[0]?.mockup_url ? urlHost(withUrl[0].mockup_url) : null,
  })

  if (withUrl.length === 0) {
    console.log('FAIL: branding mockup completed but no branding mockup_url')
    process.exit(1)
  }

  console.log('SMOKE_OK fixed branding reached Printful and returned a mockup URL')
}

main().catch((err) => {
  console.error('FAIL', err instanceof Error ? err.message : err)
  process.exit(1)
})
