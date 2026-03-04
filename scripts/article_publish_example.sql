-- Run in Supabase: SQL Editor → New query.
--
-- 1) See current articles (status and published_at must match for blog to show them):
--    status = 'published' AND published_at IS NOT NULL AND published_at <= now()

SELECT id, title, slug, status, published_at
FROM article
ORDER BY id;

-- 2) Publish one article by id (replace 1 with your article id):
-- UPDATE article
-- SET status = 'published', published_at = now(), updated_at = now()
-- WHERE id = 1;

-- 3) Publish all draft articles that have a slug (uncomment to run):
-- UPDATE article
-- SET status = 'published', published_at = COALESCE(published_at, now()), updated_at = now()
-- WHERE status = 'draft';

-- 4) Fijar published_at al pasado para artículos ya "published" con fecha futura
--    (el blog solo muestra artículos con published_at <= now())
--    Descomenta y ejecuta para que todos los publicados se vean ya en /blog:
UPDATE article
SET published_at = now(), updated_at = now()
WHERE status = 'published' AND (published_at IS NULL OR published_at > now());
