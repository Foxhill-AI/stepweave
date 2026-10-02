-- ── Phase 1: Gender attribute + backfill mockup_urls gender field ──────────

-- 1. Ensure 'gender' attribute exists
INSERT INTO attribute (name, slug)
VALUES ('Gender', 'gender')
ON CONFLICT (slug) DO NOTHING;

-- 2. Ensure attribute_option rows exist for both genders
INSERT INTO attribute_option (attribute_id, label)
SELECT id, 'Men''s' FROM attribute WHERE slug = 'gender'
ON CONFLICT DO NOTHING;

INSERT INTO attribute_option (attribute_id, label)
SELECT id, 'Women''s' FROM attribute WHERE slug = 'gender'
ON CONFLICT DO NOTHING;

-- 3. Backfill gender: 'mens' on all existing mockup_urls entries that lack the field.
--    This is safe and additive — entries already tagged are skipped.
UPDATE design_draft
SET mockup_urls = (
  SELECT jsonb_agg(
    CASE
      WHEN entry ? 'gender' THEN entry
      ELSE entry || '{"gender": "mens"}'
    END
  )
  FROM jsonb_array_elements(mockup_urls) AS entry
)
WHERE mockup_urls IS NOT NULL
  AND jsonb_typeof(mockup_urls) = 'array'
  AND jsonb_array_length(mockup_urls) > 0;
