/**
 * Builds HTML for the women's shoes blog article from the cleaned source text.
 * Run: node scripts/build-womens-shoes-html.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const sourcePath = path.join(__dirname, 'womens-shoes-article-source.txt')
const lines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

const IMG_BASE = '/blog/custom-patterns-womens-shoes'
const images = {
  1: `${IMG_BASE}/01-botanical-floral.jpg`,
  2: `${IMG_BASE}/02-geometric-abstract.jpg`,
  3: `${IMG_BASE}/03-animal-nature.jpg`,
  4: `${IMG_BASE}/04-cultural-folk.jpg`,
  5: `${IMG_BASE}/05-celestial-cosmic.jpg`,
  6: `${IMG_BASE}/06-food-whimsical.jpg`,
  7: `${IMG_BASE}/07-tie-dye.jpg`,
  8: `${IMG_BASE}/08-typography.jpg`,
  9: `${IMG_BASE}/09-patchwork-collage.jpg`,
  10: `${IMG_BASE}/10-seasonal-holiday.jpg`,
}

const alts = {
  1: 'Wildflower meadow in natural light',
  2: 'Colorful terrazzo and geometric surfaces',
  3: 'Leopard print textile and butterfly wing',
  4: 'Folk embroidery and indigo textiles',
  5: 'Milky Way night sky with crescent moon',
  6: 'Fresh fruit flat lay on marble',
  7: 'Rainbow spiral tie-dye fabric',
  8: 'Vintage letterpress type and calligraphy',
  9: 'Handmade patchwork quilt close-up',
  10: 'Frosted pine branches and snowflakes',
}

function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function p(text) {
  return `<p>${esc(text)}</p>`
}

function h2(text) {
  return `<h2>${esc(text)}</h2>`
}

function img(n) {
  return `<figure class="blog-article-figure"><img src="${images[n]}" alt="${esc(alts[n])}" loading="lazy" width="1200" height="680" /></figure>`
}

function ul(items) {
  const lis = items
    .map((item) => {
      const m = item.match(/^([^:]+):\s*(.*)$/)
      if (m) return `<li><strong>${esc(m[1])}:</strong> ${esc(m[2])}</li>`
      return `<li>${esc(item)}</li>`
    })
    .join('')
  return `<ul>${lis}</ul>`
}

// Skip title/subtitle (shown by page chrome); start from intro body
const title = lines[0]
const subtitle = lines[1]
const bodyLines = lines.slice(2)

const htmlParts = []
let i = 0

function peek() {
  return bodyLines[i]
}
function take() {
  return bodyLines[i++]
}
function isHeading(line) {
  return (
    line === 'Why Customize Your Shoes?' ||
    line === 'Pattern Inspiration: 10 Ideas for Custom Shoe Design' ||
    line === 'Final Thoughts' ||
    /^\d+\.\s/.test(line)
  )
}
function isTip(line) {
  return line.startsWith('Color direction:') || line.startsWith('Design tip:')
}
function isListItem(line) {
  return /^[^:]+:\s+.+/.test(line) && !isTip(line) && !isHeading(line)
}

while (i < bodyLines.length) {
  const line = peek()

  // Section headings (no leading number, or numbered pattern sections)
  if (isHeading(line)) {
    const heading = take()
    // Numbered pattern sections get image after heading
    const numMatch = heading.match(/^(\d+)\.\s/)
    htmlParts.push(h2(heading))
    if (numMatch) {
      const n = Number(numMatch[1])
      if (images[n]) htmlParts.push(img(n))
    }
    continue
  }

  // Collect bullet-like "Label: description" runs
  if (isListItem(line)) {
    const items = []
    while (i < bodyLines.length && isListItem(peek())) {
      items.push(take())
    }
    htmlParts.push(ul(items))
    continue
  }

  // Callout tips
  if (line.startsWith('Color direction:') || line.startsWith('Design tip:')) {
    const tip = take()
    const m = tip.match(/^([^:]+):\s*(.*)$/)
    htmlParts.push(
      `<p class="blog-article-tip"><strong>${esc(m[1])}:</strong> ${esc(m[2])}</p>`
    )
    continue
  }

  htmlParts.push(p(take()))
}

const contentHtml = htmlParts.join('\n')

const summary =
  "A practical guide to designing custom patterns for women's shoes, with ten pattern directions from florals to seasonal themes."

const seoTitle = "Step Into Your Style: How to Design Custom Patterns for Women's Shoes"
const seoDescription =
  "Ten pattern ideas for custom women's shoes: botanicals, geometrics, animal prints, folk art, celestial, typography, tie-dye, and more."

const article = {
  title: 'Step Into Your Style',
  slug: 'custom-patterns-womens-shoes',
  summary,
  seo_title: seoTitle,
  seo_description: seoDescription,
  content: contentHtml,
  subtitle,
}

const htmlOut = path.join(__dirname, 'womens-shoes-article-content.html')
fs.writeFileSync(htmlOut, contentHtml, 'utf8')

const jsonOut = path.join(__dirname, 'womens-shoes-article.json')
fs.writeFileSync(jsonOut, JSON.stringify(article, null, 2), 'utf8')

// SQL with dollar-quoting so HTML needs no escape
const sql = `-- Publish: Step Into Your Style (women's shoes custom patterns)
-- Run in Supabase SQL Editor. Safe to re-run (upserts by slug).

INSERT INTO article (
  title,
  slug,
  content,
  summary,
  seo_title,
  seo_description,
  status,
  published_at,
  updated_at
) VALUES (
  $${article.title.replace(/'/g, "''")}$$,
  'custom-patterns-womens-shoes',
  $html$${contentHtml}$html$,
  $sum$${summary}$sum$,
  $seo$${seoTitle}$seo$,
  $desc$${seoDescription}$desc$,
  'published',
  now(),
  now()
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  summary = EXCLUDED.summary,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description,
  status = 'published',
  published_at = COALESCE(article.published_at, now()),
  updated_at = now();

-- If ON CONFLICT fails (no unique on slug), use this instead:
-- DELETE FROM article WHERE slug = 'custom-patterns-womens-shoes';
-- then re-run the INSERT without ON CONFLICT.
`

// Fix title quoting - I used wrong dollar quote for title. Use simple escaped string for short fields.
const sqlFixed = `-- Publish: Step Into Your Style (women's shoes custom patterns)
-- Run in Supabase → SQL Editor.
-- Images are served from the Next.js app at /blog/custom-patterns-womens-shoes/*.jpg
-- Deploy the app (or at least public/blog/...) before or with this insert.

INSERT INTO article (
  title,
  slug,
  content,
  summary,
  seo_title,
  seo_description,
  status,
  published_at,
  updated_at
)
SELECT
  'Step Into Your Style',
  'custom-patterns-womens-shoes',
  $html$${contentHtml}$html$,
  $sum$${summary}$sum$,
  $seo$${seoTitle}$seo$,
  $desc$${seoDescription}$desc$,
  'published',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM article WHERE slug = 'custom-patterns-womens-shoes'
);

UPDATE article SET
  title = 'Step Into Your Style',
  content = $html$${contentHtml}$html$,
  summary = $sum$${summary}$sum$,
  seo_title = $seo$${seoTitle}$seo$,
  seo_description = $desc$${seoDescription}$desc$,
  status = 'published',
  published_at = COALESCE(published_at, now()),
  updated_at = now()
WHERE slug = 'custom-patterns-womens-shoes';

SELECT id, title, slug, status, published_at
FROM article
WHERE slug = 'custom-patterns-womens-shoes';
`

fs.writeFileSync(path.join(__dirname, 'publish-womens-shoes-article.sql'), sqlFixed, 'utf8')

console.log('Wrote:')
console.log(' -', path.relative(root, htmlOut))
console.log(' -', path.relative(root, jsonOut))
console.log(' - scripts/publish-womens-shoes-article.sql')
console.log('HTML length:', contentHtml.length)
console.log('Title:', title)
console.log('Subtitle:', subtitle)
