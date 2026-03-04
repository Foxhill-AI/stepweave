-- Allow users to insert order_item rows for their own orders (during checkout).
-- Run this in Supabase: Dashboard → SQL Editor → New query → paste and run.
-- Fixes: 42501 "new row violates row-level security policy for table order_item"

CREATE POLICY "Users can insert order items for own orders"
  ON order_item
  FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT id FROM user_order
      WHERE user_account_id IN (
        SELECT id FROM user_account WHERE auth_user_id = auth.uid()
      )
    )
  );
