-- Allow anyone (including anonymous) to read published articles (for /blog).
-- Without this, RLS blocks SELECT and the blog index shows no articles.
-- Run this in Supabase: Dashboard → SQL Editor → New query → paste and run.
--
-- Your articles must also have:
--   status = 'published'
--   published_at set (not null) and in the past (or now)

DROP POLICY IF EXISTS "Anyone can select published articles" ON article;
z
CREATE POLICY "Anyone can select published articles"
  ON article
  FOR SELECT
  USING (status = 'published' AND published_at IS NOT NULL AND published_at <= now());
