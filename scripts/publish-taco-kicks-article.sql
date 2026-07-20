-- Publish: Taco Kicks customer spotlight
-- 1) Put the shoe photo at public/blog/taco-kicks/taco-kicks.jpg and deploy.
-- 2) Run this in Supabase → SQL Editor (Run without RLS).

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
  'Taco Kicks: Custom Shoes for Two Tacos & a Hike',
  'taco-kicks-two-tacos-and-a-hike',
  $html$<p>Every so often someone opens the Step Weave design tool and walks out with something that makes us stop scrolling. This is one of those times.</p>
<p>The creator behind <a href="https://twotacosandahike.beehiiv.com/" target="_blank" rel="noopener noreferrer">Two Tacos &amp; a Hike</a> (a newsletter full of weekly date ideas and advice) designed a pair of custom shoes for her brand: the <strong>Taco Kicks</strong>.</p>
<figure class="blog-article-figure"><img src="/blog/taco-kicks/taco-kicks.jpg" alt="Custom Taco Kicks design: two tacos and a mountain hike scene created in Step Weave" loading="lazy" width="1200" height="1200" /></figure>
<p>Aren't they cool?</p>
<p>She built this design in our design tool, from artwork to placement on the shoe, and turned her brand into footwear you can actually wear. Product #76: Taco Kicks. Bold, playful, and clearly hers.</p>
<h2>Why this matters</h2>
<p>Custom shoes used to mean a long back-and-forth with a factory, or settling for a logo slap on a blank pair. Here, she put the whole vibe of her newsletter on a real product: tacos, a trail, mountains, and a little mischief. Something her readers can spot from across the room.</p>
<p>That is the point of Step Weave. You bring the idea. The tool helps you place it, preview it, and get it made.</p>
<h2>Want to see more from her?</h2>
<p>Follow along at <a href="https://twotacosandahike.beehiiv.com/" target="_blank" rel="noopener noreferrer">twotacosandahike.beehiiv.com</a> for weekly date ideas that are a lot more fun than "want to grab coffee?"</p>
<p>And if you have a brand, a joke, or a pattern stuck in your head: open the design tool and make your own pair. We will be here cheering when they land.</p>$html$,
  $sum$A newsletter founder used the Step Weave design tool to create Taco Kicks for her brand, Two Tacos & a Hike. Here is the finished pair.$sum$,
  $seo$Taco Kicks: Custom Shoes for Two Tacos & a Hike | Step Weave$seo$,
  $desc$See the Taco Kicks: custom shoes designed in Step Weave for Two Tacos & a Hike, a newsletter for weekly date ideas.$desc$,
  'published',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM article WHERE slug = 'taco-kicks-two-tacos-and-a-hike'
);

UPDATE article SET
  title = 'Taco Kicks: Custom Shoes for Two Tacos & a Hike',
  content = $html$<p>Every so often someone opens the Step Weave design tool and walks out with something that makes us stop scrolling. This is one of those times.</p>
<p>The creator behind <a href="https://twotacosandahike.beehiiv.com/" target="_blank" rel="noopener noreferrer">Two Tacos &amp; a Hike</a> (a newsletter full of weekly date ideas and advice) designed a pair of custom shoes for her brand: the <strong>Taco Kicks</strong>.</p>
<figure class="blog-article-figure"><img src="/blog/taco-kicks/taco-kicks.jpg" alt="Custom Taco Kicks design: two tacos and a mountain hike scene created in Step Weave" loading="lazy" width="1200" height="1200" /></figure>
<p>Aren't they cool?</p>
<p>She built this design in our design tool, from artwork to placement on the shoe, and turned her brand into footwear you can actually wear. Product #76: Taco Kicks. Bold, playful, and clearly hers.</p>
<h2>Why this matters</h2>
<p>Custom shoes used to mean a long back-and-forth with a factory, or settling for a logo slap on a blank pair. Here, she put the whole vibe of her newsletter on a real product: tacos, a trail, mountains, and a little mischief. Something her readers can spot from across the room.</p>
<p>That is the point of Step Weave. You bring the idea. The tool helps you place it, preview it, and get it made.</p>
<h2>Want to see more from her?</h2>
<p>Follow along at <a href="https://twotacosandahike.beehiiv.com/" target="_blank" rel="noopener noreferrer">twotacosandahike.beehiiv.com</a> for weekly date ideas that are a lot more fun than "want to grab coffee?"</p>
<p>And if you have a brand, a joke, or a pattern stuck in your head: open the design tool and make your own pair. We will be here cheering when they land.</p>$html$,
  summary = $sum$A newsletter founder used the Step Weave design tool to create Taco Kicks for her brand, Two Tacos & a Hike. Here is the finished pair.$sum$,
  seo_title = $seo$Taco Kicks: Custom Shoes for Two Tacos & a Hike | Step Weave$seo$,
  seo_description = $desc$See the Taco Kicks: custom shoes designed in Step Weave for Two Tacos & a Hike, a newsletter for weekly date ideas.$desc$,
  status = 'published',
  published_at = COALESCE(published_at, now()),
  updated_at = now()
WHERE slug = 'taco-kicks-two-tacos-and-a-hike';

SELECT id, title, slug, status, published_at
FROM article
WHERE slug = 'taco-kicks-two-tacos-and-a-hike';
