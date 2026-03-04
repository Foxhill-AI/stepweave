-- Allow users to update their own orders (e.g. set stripe_checkout_session_id after creating Stripe session).
-- Without this, the checkout API cannot save the session_id and the confirmation page finds no order.
-- Run this in Supabase: Dashboard → SQL Editor → New query → paste and run.

DROP POLICY IF EXISTS "Users can update own orders" ON user_order;

CREATE POLICY "Users can update own orders"
  ON user_order
  FOR UPDATE
  USING (
    user_account_id IN (
      SELECT id FROM user_account WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_account_id IN (
      SELECT id FROM user_account WHERE auth_user_id = auth.uid()
    )
  );
