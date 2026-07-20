/**
 * Publish the women's shoes article to Supabase.
 *
 * Requires env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage (PowerShell):
 *   $env:NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   node scripts/publish-womens-shoes-article.mjs
 *
 * Or put those in .env.local and:
 *   node --env-file=.env.local scripts/publish-womens-shoes-article.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const article = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'womens-shoes-article.json'), 'utf8')
)

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY')
  console.error('Set them in the environment, then re-run this script.')
  console.error('Alternatively, run scripts/publish-womens-shoes-article.sql in the Supabase SQL Editor.')
  process.exit(1)
}

const row = {
  title: article.title,
  slug: article.slug,
  content: article.content,
  summary: article.summary,
  seo_title: article.seo_title,
  seo_description: article.seo_description,
  status: 'published',
  published_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

async function main() {
  // Check existing
  const findRes = await fetch(
    `${url}/rest/v1/article?slug=eq.${encodeURIComponent(article.slug)}&select=id,slug,status`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    }
  )
  if (!findRes.ok) {
    console.error('Lookup failed:', findRes.status, await findRes.text())
    process.exit(1)
  }
  const existing = await findRes.json()

  let res
  if (existing.length > 0) {
    console.log(`Updating existing article id=${existing[0].id}…`)
    res = await fetch(`${url}/rest/v1/article?slug=eq.${encodeURIComponent(article.slug)}`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        title: row.title,
        content: row.content,
        summary: row.summary,
        seo_title: row.seo_title,
        seo_description: row.seo_description,
        status: 'published',
        published_at: existing[0].published_at || row.published_at,
        updated_at: row.updated_at,
      }),
    })
  } else {
    console.log('Inserting new article…')
    res = await fetch(`${url}/rest/v1/article`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(row),
    })
  }

  if (!res.ok) {
    console.error('Publish failed:', res.status, await res.text())
    process.exit(1)
  }

  const saved = await res.json()
  const articleRow = Array.isArray(saved) ? saved[0] : saved
  console.log('Published:', {
    id: articleRow.id,
    slug: articleRow.slug,
    status: articleRow.status,
    published_at: articleRow.published_at,
  })
  console.log(`Live path: /blog/${article.slug}`)
  console.log('Note: images are under public/blog/... — deploy the site so they load on stepweave.com.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
