/**
 * Builds HTML + SQL for the flower shoes and shirt-match vans blog posts.
 * Run: node scripts/build-personal-shoe-posts.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function writePublishSql(article) {
  const sql = `-- Publish: ${article.title}
-- Run in Supabase → SQL Editor → "Run without RLS".
-- Safe: every write is scoped to slug = '${article.slug}'.

DELETE FROM article
WHERE slug = '${article.slug}';

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
  '${article.title.replace(/'/g, "''")}',
  '${article.slug}',
  $html$${article.content}$html$,
  '${article.summary.replace(/'/g, "''")}',
  '${article.seo_title.replace(/'/g, "''")}',
  '${article.seo_description.replace(/'/g, "''")}',
  'published',
  now(),
  now()
);

SELECT id, title, slug, status, published_at
FROM article
WHERE slug = '${article.slug}';
`
  const out = path.join(__dirname, article.sqlFile)
  fs.writeFileSync(out, sql, 'utf8')
  fs.writeFileSync(path.join(__dirname, article.htmlFile), article.content, 'utf8')
  fs.writeFileSync(
    path.join(__dirname, article.jsonFile),
    JSON.stringify(
      {
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        seo_title: article.seo_title,
        seo_description: article.seo_description,
        content: article.content,
      },
      null,
      2
    ),
    'utf8'
  )
  console.log('Wrote', article.sqlFile)
}

const flower = {
  title: 'Flower Shoes From a Photo I Took',
  slug: 'flower-shoes-from-my-photo',
  summary:
    'I snapped a picture of pink flowers in my garden, then used Step Weave to put that print on a pair of shoes. Here is the finished look next to the real blooms.',
  seo_title: 'Flower Shoes From a Photo I Took | Step Weave',
  seo_description:
    'Custom floral sneakers designed in Step Weave from a real garden photo. See the finished flower shoes beside the blooms that inspired them.',
  sqlFile: 'publish-flower-shoes-article.sql',
  htmlFile: 'flower-shoes-article-content.html',
  jsonFile: 'flower-shoes-article.json',
  content: [
    `<p>I took a picture of pink flowers in my garden and could not stop thinking about them. So I opened the Step Weave design tool and put that print on a pair of shoes.</p>`,
    `<figure class="blog-article-figure"><img src="/blog/flower-shoes/01-cover.jpg" alt="Custom pink flower sneakers worn next to matching garden blooms" loading="lazy" width="767" height="1024" /></figure>`,
    `<p>Standing next to the real blooms felt a little wild. Same pinks. Same energy. Except one pair walks.</p>`,
    `<h2>From phone photo to footwear</h2>`,
    `<p>No factory sketch session. No "close enough" stock print. I used my own photo, placed the pattern on the shoe, and ordered the pair.</p>`,
    `<p>That is the fun of custom design: the idea starts in real life, and the shoes come back looking like they belong there.</p>`,
    `<p>If you have a photo you love, try it. Gardens, trips, fabric scraps, whatever. Turn it into something you can wear.</p>`,
  ].join('\n'),
}

const vans = {
  title: 'Custom Vans From a Shirt I Wanted to Match',
  slug: 'custom-vans-from-a-shirt',
  summary:
    'I had a shirt with a print I loved and used Step Weave to turn that look into custom slip-on vans. Same vibe, now on my feet.',
  seo_title: 'Custom Vans From a Shirt I Wanted to Match | Step Weave',
  seo_description:
    'Custom navy paisley slip-on vans designed in Step Weave from a shirt print. See the finished shoes in everyday life.',
  sqlFile: 'publish-shirt-match-vans-article.sql',
  htmlFile: 'shirt-match-vans-article-content.html',
  jsonFile: 'shirt-match-vans-article.json',
  content: [
    `<p>I had a shirt with a print I really wanted to match. Instead of hunting for "something similar," I used Step Weave and put that look on a pair of slip-on vans.</p>`,
    `<figure class="blog-article-figure"><img src="/blog/shirt-match-vans/01-cover.jpg" alt="Custom navy paisley slip-on vans on a wooden table with indigo fabrics" loading="lazy" width="767" height="1024" /></figure>`,
    `<p>Navy, gold, cream, little florals and paisley everywhere. It reads like textile, not a logo slap.</p>`,
    `<h2>Wearing the match</h2>`,
    `<p>Once they arrived, I wore them around the house and out. Same print energy as the shirt, now under jeans and joggers.</p>`,
    `<figure class="blog-article-figure"><img src="/blog/shirt-match-vans/02-studio.jpg" alt="Custom paisley vans with art books and a small vase" loading="lazy" width="767" height="1024" /></figure>`,
    `<figure class="blog-article-figure"><img src="/blog/shirt-match-vans/03-stairs.jpg" alt="Custom paisley vans worn on hardwood stairs" loading="lazy" width="1024" height="574" /></figure>`,
    `<figure class="blog-article-figure"><img src="/blog/shirt-match-vans/04-compass.jpg" alt="Custom paisley vans with compass and lavender on hardwood floor" loading="lazy" width="767" height="1024" /></figure>`,
    `<p>If you have a shirt, jacket, or scrap of fabric you keep reaching for, that can be a shoe. Upload the inspiration, place it, and make the match real.</p>`,
  ].join('\n'),
}

writePublishSql(flower)
writePublishSql(vans)
console.log('Done.')
