/**
 * Builds HTML + SQL for the Taco Kicks customer spotlight article.
 * Place the shoe photo at: public/blog/taco-kicks/taco-kicks.jpg
 * Then: node scripts/build-taco-kicks-html.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const imgRel = '/blog/taco-kicks/taco-kicks.jpg'
const imgDesignRel = '/blog/taco-kicks/taco-kicks-design.jpg'
const imgPath = path.join(root, 'public', 'blog', 'taco-kicks', 'taco-kicks.jpg')

const SITE_URL = 'https://twotacosandahike.beehiiv.com/'

function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const contentHtml = [
  `<p>Every so often someone opens the Step Weave design tool and walks out with something that makes us stop scrolling. This is one of those times.</p>`,
  `<p>The creator behind <a href="${esc(SITE_URL)}" target="_blank" rel="noopener noreferrer">Two Tacos &amp; a Hike</a> (a newsletter full of weekly date ideas and advice) designed a pair of custom shoes for her brand: the <strong>Taco Kicks</strong>.</p>`,
  `<figure class="blog-article-figure"><img src="${imgRel}" alt="Taco Kicks custom shoes with Two Tacos and a Hike artwork" loading="lazy" width="1400" height="788" /></figure>`,
  `<p>Aren't they cool?</p>`,
  `<p>She built this design in our design tool, from artwork to placement on the shoe, and turned her brand into footwear you can actually wear. Product #76: Taco Kicks. Bold, playful, and clearly hers.</p>`,
  `<figure class="blog-article-figure"><img src="${imgDesignRel}" alt="Two Tacos and a Hike custom artwork used on the Taco Kicks" loading="lazy" width="1200" height="1200" /></figure>`,
  `<p>That is the artwork she placed on the pair: two tacos, a trail, mountains, and a little mischief.</p>`,
  `<h2>Why this matters</h2>`,
  `<p>Custom shoes used to mean a long back-and-forth with a factory, or settling for a logo slap on a blank pair. Here, she put the whole vibe of her newsletter on a real product. Something her readers can spot from across the room.</p>`,
  `<p>That is the point of Step Weave. You bring the idea. The tool helps you place it, preview it, and get it made.</p>`,
  `<h2>Want to see more from her?</h2>`,
  `<p>Follow along at <a href="${esc(SITE_URL)}" target="_blank" rel="noopener noreferrer">twotacosandahike.beehiiv.com</a> for weekly date ideas that are a lot more fun than "want to grab coffee?"</p>`,
  `<p>And if you have a brand, a joke, or a pattern stuck in your head: open the design tool and make your own pair. We will be here cheering when they land.</p>`,
].join('\n')

const article = {
  title: 'Taco Kicks: Custom Shoes for Two Tacos & a Hike',
  slug: 'taco-kicks-two-tacos-and-a-hike',
  summary:
    'A newsletter founder used the Step Weave design tool to create Taco Kicks for her brand, Two Tacos & a Hike. Here is the finished pair.',
  seo_title: 'Taco Kicks: Custom Shoes for Two Tacos & a Hike | Step Weave',
  seo_description:
    'See the Taco Kicks: custom shoes designed in Step Weave for Two Tacos & a Hike, a newsletter for weekly date ideas.',
  content: contentHtml,
}

const htmlOut = path.join(__dirname, 'taco-kicks-article-content.html')
const jsonOut = path.join(__dirname, 'taco-kicks-article.json')
fs.writeFileSync(htmlOut, contentHtml, 'utf8')
fs.writeFileSync(jsonOut, JSON.stringify(article, null, 2), 'utf8')

const sql = `-- Publish: Taco Kicks customer spotlight
-- Run in Supabase → SQL Editor → "Run without RLS".
-- Cover image is the shoes photo at /blog/taco-kicks/taco-kicks.jpg
-- Safe: every write is scoped to slug = 'taco-kicks-two-tacos-and-a-hike'.

DELETE FROM article
WHERE slug = 'taco-kicks-two-tacos-and-a-hike';

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
  'Taco Kicks: Custom Shoes for Two Tacos & a Hike',
  'taco-kicks-two-tacos-and-a-hike',
  $html$${contentHtml}$html$,
  '${article.summary.replace(/'/g, "''")}',
  '${article.seo_title.replace(/'/g, "''")}',
  '${article.seo_description.replace(/'/g, "''")}',
  'published',
  now(),
  now()
);

SELECT id, title, slug, status, published_at
FROM article
WHERE slug = 'taco-kicks-two-tacos-and-a-hike';
`

fs.writeFileSync(path.join(__dirname, 'publish-taco-kicks-article.sql'), sql, 'utf8')

console.log('Wrote article HTML, JSON, and SQL.')
console.log(fs.existsSync(imgPath) ? `Image found: ${imgPath}` : `MISSING image: save the shoe photo as:\n  ${imgPath}`)
