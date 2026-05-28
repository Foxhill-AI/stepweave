-- Stripe Connect Express setup + product base_cost column.
-- Run once; safe to re-run (IF NOT EXISTS / column guards).

-- Store Printful fulfillment cost at publish time so checkout can compute margin correctly.
ALTER TABLE product
  ADD COLUMN IF NOT EXISTS base_cost NUMERIC(10,2) DEFAULT NULL;

-- Stripe Connect Express columns on user_account.

ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id         text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted  boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_completed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_connect_last_synced_at     timestamptz DEFAULT NULL;

-- Track one Connect Transfer per seller per order (idempotency).
CREATE TABLE IF NOT EXISTS order_connect_transfer (
  id                      bigserial    PRIMARY KEY,
  user_order_id           integer      NOT NULL REFERENCES user_order(id) ON DELETE CASCADE,
  seller_user_account_id  integer      NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  amount_cents            integer      NOT NULL,
  currency                text         NOT NULL DEFAULT 'usd',
  stripe_transfer_id      text         NOT NULL,
  stripe_charge_id        text         NOT NULL,
  created_at              timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (user_order_id, seller_user_account_id)
);

-- Only service role writes (transfers are created server-side in the webhook).
ALTER TABLE order_connect_transfer ENABLE ROW LEVEL SECURITY;

-- Sellers can see their own transfer records.
CREATE POLICY "Sellers can view own transfers"
  ON order_connect_transfer FOR SELECT
  USING (seller_user_account_id IN (
    SELECT id FROM user_account WHERE auth_user_id = auth.uid()
  ));
