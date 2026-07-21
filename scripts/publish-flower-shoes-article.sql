-- Publish: Flower Shoes From a Photo I Took
-- Run in Supabase → SQL Editor → "Run without RLS".
-- Safe: every write is scoped to slug = 'flower-shoes-from-my-photo'.

DELETE FROM article
WHERE slug = 'flower-shoes-from-my-photo';

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
  'Flower Shoes From a Photo I Took',
  'flower-shoes-from-my-photo',
  $html$<p>I took a picture of pink flowers in my garden and could not stop thinking about them. So I opened the Step Weave design tool and put that print on a pair of shoes.</p>
<figure class="blog-article-figure"><img src="/blog/flower-shoes/01-cover.jpg" alt="Custom pink flower sneakers worn next to matching garden blooms" loading="lazy" width="767" height="1024" /></figure>
<p>Standing next to the real blooms felt a little wild. Same pinks. Same energy. Except one pair walks.</p>
<h2>From phone photo to footwear</h2>
<p>No factory sketch session. No "close enough" stock print. I used my own photo, placed the pattern on the shoe, and ordered the pair.</p>
<p>That is the fun of custom design: the idea starts in real life, and the shoes come back looking like they belong there.</p>
<p>If you have a photo you love, try it. Gardens, trips, fabric scraps, whatever. Turn it into something you can wear.</p>$html$,
  'I snapped a picture of pink flowers in my garden, then used Step Weave to put that print on a pair of shoes. Here is the finished look next to the real blooms.',
  'Flower Shoes From a Photo I Took | Step Weave',
  'Custom floral sneakers designed in Step Weave from a real garden photo. See the finished flower shoes beside the blooms that inspired them.',
  'published',
  now(),
  now()
);

SELECT id, title, slug, status, published_at
FROM article
WHERE slug = 'flower-shoes-from-my-photo';
