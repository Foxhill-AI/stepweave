-- Publish: Custom Vans From a Shirt I Wanted to Match
-- Run in Supabase → SQL Editor → "Run without RLS".
-- Safe: every write is scoped to slug = 'custom-vans-from-a-shirt'.

DELETE FROM article
WHERE slug = 'custom-vans-from-a-shirt';

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
  'Custom Vans From a Shirt I Wanted to Match',
  'custom-vans-from-a-shirt',
  $html$<p>I had a shirt with a print I really wanted to match. Instead of hunting for "something similar," I used Step Weave and put that look on a pair of slip-on vans.</p>
<figure class="blog-article-figure"><img src="/blog/shirt-match-vans/01-cover.jpg" alt="Custom navy paisley slip-on vans on a wooden table with indigo fabrics" loading="lazy" width="767" height="1024" /></figure>
<p>Navy, gold, cream, little florals and paisley everywhere. It reads like textile, not a logo slap.</p>
<h2>Wearing the match</h2>
<p>Once they arrived, I wore them around the house and out. Same print energy as the shirt, now under jeans and joggers.</p>
<figure class="blog-article-figure"><img src="/blog/shirt-match-vans/02-studio.jpg" alt="Custom paisley vans with art books and a small vase" loading="lazy" width="767" height="1024" /></figure>
<figure class="blog-article-figure"><img src="/blog/shirt-match-vans/03-stairs.jpg" alt="Custom paisley vans worn on hardwood stairs" loading="lazy" width="1024" height="574" /></figure>
<figure class="blog-article-figure"><img src="/blog/shirt-match-vans/04-compass.jpg" alt="Custom paisley vans with compass and lavender on hardwood floor" loading="lazy" width="767" height="1024" /></figure>
<p>If you have a shirt, jacket, or scrap of fabric you keep reaching for, that can be a shoe. Upload the inspiration, place it, and make the match real.</p>$html$,
  'I had a shirt with a print I loved and used Step Weave to turn that look into custom slip-on vans. Same vibe, now on my feet.',
  'Custom Vans From a Shirt I Wanted to Match | Step Weave',
  'Custom navy paisley slip-on vans designed in Step Weave from a shirt print. See the finished shoes in everyday life.',
  'published',
  now(),
  now()
);

SELECT id, title, slug, status, published_at
FROM article
WHERE slug = 'custom-vans-from-a-shirt';
