-- Allow users to read order_item rows for their own orders (needed for order confirmation with nested items).
-- Run this in Supabase: Dashboard → SQL Editor → New query → paste and run.
-- If the confirmation API selects user_order with order_item (...), RLS on order_item can block the relation;
-- this policy lets the same user see items for orders they own.

DROP POLICY IF EXISTS "Users can select order items for own orders" ON order_item;

CREATE POLICY "Users can select order items for own orders"
  ON order_item
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM user_order
      WHERE user_account_id IN (
        SELECT id FROM user_account WHERE auth_user_id = auth.uid()
      )
    )
  );
