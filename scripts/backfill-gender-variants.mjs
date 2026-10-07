/**
 * scripts/backfill-gender-variants.mjs
 *
 * Backfills gender variants on all pre-unification products.
 *
 * For each active product without gender variants it:
 *   1. Determines canonical mens/womens pair from UNIFIED_MODEL_PRICING
 *   2. Adds the correct gender attribute option to all existing variants
 *   3. Fetches the "other gender" Printful variants and inserts them with size + gender options
 *   4. Normalizes design_data (canonical mensId, product_id_womens, unified name)
 *   5. For originally-womens products: re-tags mockup_urls from 'mens' → 'womens' in design_draft
 *
 * Run:
 *   node scripts/backfill-gender-variants.mjs [--dry-run]
 *
 * Womens mockup generation for originally-mens products is NOT triggered here
 * (requires INTERNAL_API_SECRET only available in Vercel). After this script completes,
 * run: node scripts/trigger-womens-mockups.mjs  (once INTERNAL_API_SECRET is available)
 */

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
if (DRY_RUN) console.log('🔍 DRY RUN — no writes will be made\n')

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://ticbffbhohsofmarvdni.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpY2JmZmJob2hzb2ZtYXJ2ZG5pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgxNjczMCwiZXhwIjoyMDg4MzkyNzMwfQ.XWSAmmVl_2_cpqwob2SX_lfLTUxqqh3V9m1lOnMtQQU'
const PRINTFUL_API_KEY = 'D3qPfgaN7gZftuI02XdP7HZDcy8JWET8pgVXIBD9'
const PRINTFUL_STORE_ID = '17400820'

const UNIFIED_MODEL_PRICING = [
  { mensId: '657', womensId: '658', name: 'Athletic Shoes' },
  { mensId: '513', womensId: '525', name: 'High Top Canvas Shoes' },
  { mensId: '578', womensId: '579', name: 'Lace-Up Canvas Shoes' },
  { mensId: '574', womensId: '575', name: 'Slip-On Canvas Shoes' },
  { mensId: '597', womensId: '598', name: 'Slides' },
]

// Gender attribute and option IDs (confirmed from migration)
const GENDER_ATTR_ID = 2
const MENS_OPTION_ID = 18
const WOMENS_OPTION_ID = 19

const admin = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Helpers ───────────────────────────────────────────────────────────────────

function findPair(baseModelId) {
  const id = String(baseModelId).trim()
  return UNIFIED_MODEL_PRICING.find((p) => p.mensId === id || p.womensId === id) ?? null
}

// Cache Printful variant lists to avoid duplicate API calls for the same product
const pfVariantCache = new Map()

async function fetchPrintfulVariants(productId, structuralColor) {
  if (pfVariantCache.has(productId)) return pfVariantCache.get(productId)

  const res = await fetch(`https://api.printful.com/products/${productId}`)
  if (!res.ok) throw new Error(`Printful ${productId}: ${res.status}`)
  const data = await res.json()
  const all = data.result?.variants ?? []

  const color = (structuralColor ?? 'white').toLowerCase()
  const colorFiltered = all.filter((v) => (v.color ?? '').toLowerCase().includes(color))
  const source = colorFiltered.length > 0 ? colorFiltered : all

  const seen = new Set()
  const variants = []
  for (const v of source) {
    const sz = (v.size ?? '').trim()
    if (!sz || seen.has(sz)) continue
    seen.add(sz)
    variants.push({ id: v.id, size: sz })
  }

  pfVariantCache.set(productId, variants)
  return variants
}

// Get or create a size attribute_option for the given label
const sizeOptionCache = new Map()
async function getSizeOptionId(sizeLabel) {
  if (sizeOptionCache.has(sizeLabel)) return sizeOptionCache.get(sizeLabel)

  // Find the 'size' attribute id first (assume it's the one that's not gender)
  const { data: sizeAttr } = await admin.from('attribute').select('id').eq('slug', 'size').maybeSingle()
  const sizeAttrId = sizeAttr?.id
  if (!sizeAttrId) throw new Error('Size attribute not found')

  const { data: existing } = await admin
    .from('attribute_option')
    .select('id')
    .eq('attribute_id', sizeAttrId)
    .eq('label', sizeLabel)
    .maybeSingle()

  if (existing?.id) {
    sizeOptionCache.set(sizeLabel, existing.id)
    return existing.id
  }

  if (DRY_RUN) {
    console.log(`    [dry-run] would create size option '${sizeLabel}'`)
    return null
  }

  const { data: created } = await admin
    .from('attribute_option')
    .insert({ attribute_id: sizeAttrId, label: sizeLabel })
    .select('id')
    .single()
  if (created?.id) sizeOptionCache.set(sizeLabel, created.id)
  return created?.id ?? null
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Load all active products needing backfill (no product_id_womens in design_data)
  const { data: products, error } = await admin
    .from('product')
    .select('id, name, design_data')
    .eq('status', 'active')
    .order('id')

  if (error) throw error

  const toBackfill = products.filter((p) => {
    const dd = p.design_data
    if (!dd || typeof dd !== 'object') return false
    if (dd.source !== 'design_draft') return false
    if (dd.product_id_womens) return false // already unified
    return findPair(dd.base_model_id) !== null
  })

  console.log(`Found ${toBackfill.length} products to backfill (of ${products.length} active).\n`)

  const needWomensMockups = [] // originally-mens products that need womens mockup generation

  for (const product of toBackfill) {
    const dd = product.design_data
    const baseModelId = String(dd.base_model_id).trim()
    const pair = findPair(baseModelId)
    if (!pair) continue

    const isOriginallyWomens = pair.womensId === baseModelId
    const existingGenderOptId = isOriginallyWomens ? WOMENS_OPTION_ID : MENS_OPTION_ID
    const otherGenderId = isOriginallyWomens ? pair.mensId : pair.womensId
    const otherGenderOptId = isOriginallyWomens ? MENS_OPTION_ID : WOMENS_OPTION_ID
    const structuralColor = typeof dd.structural_color === 'string' ? dd.structural_color : 'white'

    console.log(`── Product ${product.id} "${product.name}" (${isOriginallyWomens ? 'womens' : 'mens'}, base=${baseModelId})`)

    // 2. Get existing variants (they have size options but no gender option)
    const { data: existingVariants } = await admin
      .from('product_variant')
      .select('id, printful_variant_id, product_variant_attribute_option(attribute_option_id)')
      .eq('product_id', product.id)
      .eq('status', 'active')

    if (!existingVariants?.length) {
      console.log(`   ⚠ No active variants found — skipping`)
      continue
    }

    // Check if already has gender options (safety check)
    const alreadyHasGender = existingVariants.some((v) =>
      v.product_variant_attribute_option?.some(
        (o) => o.attribute_option_id === MENS_OPTION_ID || o.attribute_option_id === WOMENS_OPTION_ID
      )
    )
    if (alreadyHasGender) {
      console.log(`   ✓ Already has gender options — skipping`)
      continue
    }

    console.log(`   Existing variants: ${existingVariants.length}`)

    // 3. Add gender option to all existing variants
    if (!DRY_RUN) {
      const genderLinks = existingVariants.map((v) => ({
        product_variant_id: v.id,
        attribute_option_id: existingGenderOptId,
      }))
      const { error: linkErr } = await admin
        .from('product_variant_attribute_option')
        .insert(genderLinks)
      if (linkErr) {
        console.error(`   ✗ Failed to add gender options to existing variants:`, linkErr.message)
        continue
      }
    }
    console.log(`   ✓ Added ${isOriginallyWomens ? "Women's" : "Men's"} option to ${existingVariants.length} existing variants`)

    // 4. Fetch Printful variants for the other gender
    let otherVariants
    try {
      otherVariants = await fetchPrintfulVariants(otherGenderId, structuralColor)
    } catch (e) {
      console.error(`   ✗ Printful fetch failed for ${otherGenderId}:`, e.message)
      continue
    }
    console.log(`   Printful other-gender variants (${isOriginallyWomens ? 'mens' : 'womens'}): ${otherVariants.length}`)

    // 5. Insert product_variant rows for each other-gender size
    let insertedCount = 0
    for (const pv of otherVariants) {
      const sizeOptId = await getSizeOptionId(pv.size)
      if (!sizeOptId) continue

      if (DRY_RUN) {
        console.log(`   [dry-run] would insert variant pf=${pv.id} size=${pv.size} gender=${isOriginallyWomens ? "Men's" : "Women's"}`)
        insertedCount++
        continue
      }

      const { data: newVariant } = await admin
        .from('product_variant')
        .insert({ product_id: product.id, status: 'active', price_override: null, printful_variant_id: pv.id })
        .select('id')
        .single()
      if (!newVariant?.id) continue

      await admin.from('product_variant_attribute_option').insert([
        { product_variant_id: newVariant.id, attribute_option_id: sizeOptId },
        { product_variant_id: newVariant.id, attribute_option_id: otherGenderOptId },
      ])
      insertedCount++
    }
    console.log(`   ✓ Inserted ${insertedCount} other-gender variants`)

    // 6. Update design_data to canonical form
    const canonicalDesignData = {
      ...dd,
      base_model_id: pair.mensId,
      product_id_womens: pair.womensId,
      model_name: pair.name,
    }
    if (!DRY_RUN) {
      await admin.from('product').update({ design_data: canonicalDesignData }).eq('id', product.id)
    }
    console.log(`   ✓ design_data normalized (mensId=${pair.mensId}, womensId=${pair.womensId}, name="${pair.name}")`)

    // 7. For originally-womens products: re-tag mockup_urls from 'mens' → 'womens'
    if (isOriginallyWomens) {
      const { data: draft } = await admin
        .from('design_draft')
        .select('id, mockup_urls')
        .eq('final_product_id', product.id)
        .maybeSingle()

      if (draft?.mockup_urls && Array.isArray(draft.mockup_urls)) {
        const retagged = draft.mockup_urls.map((p) => {
          // Only re-tag entries that have no gender or were tagged 'mens' by the backfill migration
          if (!p.gender || p.gender === 'mens') return { ...p, gender: 'womens' }
          return p
        })
        if (!DRY_RUN) {
          await admin.from('design_draft').update({ mockup_urls: retagged }).eq('id', draft.id)
        }
        console.log(`   ✓ Re-tagged ${retagged.length} mockup placements mens→womens in draft ${draft.id}`)
      }
    } else {
      // Originally mens — will need womens mockup generation
      needWomensMockups.push(product.id)
    }

    console.log()
  }

  // Summary
  console.log('═══════════════════════════════════════')
  console.log(`Backfill complete.`)
  if (needWomensMockups.length > 0) {
    console.log(`\n⚠  ${needWomensMockups.length} originally-mens products need womens mockup generation.`)
    console.log(`   Product IDs: ${needWomensMockups.join(', ')}`)
    console.log(`   These products will show a pulsing dot on the Women's button until mockups are generated.`)
    console.log(`   To generate: trigger POST /api/design-drafts/{draftId}/generate-womens-mockups`)
    console.log(`   with header x-internal-key: <INTERNAL_API_SECRET> for each product's draft.`)
    console.log()
    console.log('   Draft IDs for each product:')
    for (const pid of needWomensMockups) {
      const { data } = await admin
        .from('design_draft')
        .select('id')
        .eq('final_product_id', pid)
        .maybeSingle()
      if (data?.id) console.log(`   product ${pid} → draft ${data.id}`)
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
