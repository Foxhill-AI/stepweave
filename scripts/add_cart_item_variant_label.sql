-- Add variant_label to cart_item so the cart can show the selected variant
-- for products with a single variant (e.g. only Color).
-- Run this in Supabase: SQL Editor → New query → paste and run.

ALTER TABLE cart_item
  ADD COLUMN IF NOT EXISTS variant_label text;
