-- Allow authenticated users to read their own orders (for order confirmation and profile).
-- Run this in Supabase: Dashboard → SQL Editor → New query → paste and run.
-- Fixes: confirmation page "Order not found or session expired" after Stripe redirect
--        (RLS was blocking SELECT when looking up by stripe_checkout_session_id).
-- Safe to run multiple times (drops existing policy first).

DROP POLICY IF EXISTS "Users can select own orders" ON user_order;

CREATE POLICY "Users can select own orders"
  ON user_order
  FOR SELECT
  USING (
    user_account_id IN (
      SELECT id FROM user_account WHERE auth_user_id = auth.uid()
    )
  );
