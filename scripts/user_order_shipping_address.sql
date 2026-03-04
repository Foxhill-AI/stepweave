-- Add shipping_address to user_order (for Stripe Checkout collected address).
-- Run in Supabase: Dashboard → SQL Editor → New query → paste and run.

ALTER TABLE user_order
  ADD COLUMN IF NOT EXISTS shipping_address JSONB DEFAULT NULL;

COMMENT ON COLUMN user_order.shipping_address IS 'Shipping address from Stripe Checkout (shipping_details.address), e.g. { line1, line2, city, state, postal_code, country }';
