-- Add printful_variant_id to product_variant so per-size variants created from custom shoe
-- designs can be resolved back to the correct Printful catalog variant at fulfillment time.
ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS printful_variant_id integer;
