-- Optional columns for Printful fulfillment after Stripe payment (fulfillOrderAfterPayment).
-- Run in Supabase SQL editor if your table predates this feature.

ALTER TABLE user_order
  ADD COLUMN IF NOT EXISTS fulfillment_status text DEFAULT 'pending';

ALTER TABLE user_order
  ADD COLUMN IF NOT EXISTS fulfillment_provider text;

ALTER TABLE user_order
  ADD COLUMN IF NOT EXISTS printful_order_id bigint;

ALTER TABLE user_order
  ADD COLUMN IF NOT EXISTS fulfillment_last_error text;

ALTER TABLE user_order
  ADD COLUMN IF NOT EXISTS fulfillment_submitted_at timestamptz;

COMMENT ON COLUMN user_order.printful_order_id IS 'Printful API order id after POST /orders';
COMMENT ON COLUMN user_order.fulfillment_status IS 'e.g. pending, submitted, draft_printful, failed';
