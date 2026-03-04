-- Allow interaction_type 'save' for "Save to Collection" (4.1.2).
-- Run in Supabase: Dashboard → SQL Editor → New query → paste and run.
-- If the constraint name differs, check: SELECT conname FROM pg_constraint WHERE conrelid = 'product_interaction'::regclass;

ALTER TABLE product_interaction
  DROP CONSTRAINT IF EXISTS product_interaction_interaction_type_check;

ALTER TABLE product_interaction
  ADD CONSTRAINT product_interaction_interaction_type_check
  CHECK (interaction_type IN ('view', 'like', 'download', 'save'));
