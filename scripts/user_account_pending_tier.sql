-- Add pending_tier for downgrade/cancel flow (tier to apply at period end).
-- Run in Supabase SQL Editor.

ALTER TABLE user_account
ADD COLUMN IF NOT EXISTS pending_tier text;

COMMENT ON COLUMN user_account.pending_tier IS 'Tier to apply when current subscription ends (starter or free). Set when user downgrades or cancels.';
