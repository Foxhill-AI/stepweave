-- Track monthly AI generation credit usage per user.
-- One row per user per calendar month (YYYY-MM).
CREATE TABLE IF NOT EXISTS user_credit_usage (
  id              bigserial PRIMARY KEY,
  user_account_id integer NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  month           text    NOT NULL,  -- e.g. '2026-05'
  credits_used    integer NOT NULL DEFAULT 0,
  UNIQUE (user_account_id, month)
);

-- Users can only read/write their own usage row.
ALTER TABLE user_credit_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit usage"
  ON user_credit_usage FOR SELECT
  USING (user_account_id IN (
    SELECT id FROM user_account WHERE auth_user_id = auth.uid()
  ));

-- Service role handles inserts/updates (done server-side in generate route).
