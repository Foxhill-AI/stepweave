-- Allow authenticated users to insert their own orders (for checkout).
-- Run this in Supabase: Dashboard → SQL Editor → New query → paste and run.
-- Fixes: 42501 "new row violates row-level security policy for table user_order"

CREATE POLICY "Users can insert own orders"
  ON user_order
  FOR INSERT
  WITH CHECK (
    user_account_id IN (
      SELECT id FROM user_account WHERE auth_user_id = auth.uid()
    )
  );
