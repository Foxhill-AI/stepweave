-- Notifications for "Someone liked your product" and "New follower".
-- Run in Supabase: Dashboard → SQL Editor → New query → paste and run.

CREATE TABLE IF NOT EXISTS user_notification (
  id BIGSERIAL PRIMARY KEY,
  user_account_id BIGINT NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'follow')),
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notification_user_account_id ON user_notification(user_account_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_read ON user_notification(read);
CREATE INDEX IF NOT EXISTS idx_user_notification_created_at ON user_notification(created_at DESC);

ALTER TABLE user_notification ENABLE ROW LEVEL SECURITY;

-- Recipients can read and update (mark read) their own notifications.
CREATE POLICY "Users can read own notifications"
  ON user_notification
  FOR SELECT
  USING (
    user_account_id IN (SELECT id FROM user_account WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Users can update own notifications"
  ON user_notification
  FOR UPDATE
  USING (
    user_account_id IN (SELECT id FROM user_account WHERE auth_user_id = auth.uid())
  );

-- Any authenticated user can insert (e.g. when A likes B's product, A inserts a notification for B).
CREATE POLICY "Authenticated users can insert notifications"
  ON user_notification
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

COMMENT ON TABLE user_notification IS 'In-app notifications: like, follow. Recipient is user_account_id.';
