-- When mockup_urls were last saved from Printful preview. Storefront uses mockups only if
-- mockups_generated_at >= linked product.updated_at (see API routes).

ALTER TABLE public.design_draft
  ADD COLUMN IF NOT EXISTS mockups_generated_at timestamptz;

COMMENT ON COLUMN public.design_draft.mockups_generated_at IS
  'Last time mockup_urls were persisted; must be >= product.updated_at for those URLs to be used.';

-- Existing rows: tie to product row so current mockups keep working until the product is updated.
UPDATE public.design_draft d
SET mockups_generated_at = p.updated_at
FROM public.product p
WHERE p.id = d.final_product_id
  AND d.mockup_urls IS NOT NULL
  AND jsonb_typeof(d.mockup_urls) = 'array'
  AND jsonb_array_length(d.mockup_urls) > 0
  AND d.mockups_generated_at IS NULL;
