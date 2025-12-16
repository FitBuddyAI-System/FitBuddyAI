-- Migration 003: RLS policies for fitbuddyai_refresh_tokens
-- Ensure table exists (created in previous migration)

-- Enable Row Level Security
ALTER TABLE IF EXISTS fitbuddyai_refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow server/service role to insert/select/update/delete rows.
-- This assumes your service role is represented in JWT claim `role` as 'service' or you can adapt to 'admin'.
DROP POLICY IF EXISTS refresh_tokens_service_only ON fitbuddyai_refresh_tokens;
CREATE POLICY refresh_tokens_service_only
  ON fitbuddyai_refresh_tokens
  FOR ALL
  USING (current_setting('jwt.claims.role', true) = 'service')
  WITH CHECK (current_setting('jwt.claims.role', true) = 'service');

-- In addition, create a limited policy to allow a user to revoke their own session via a secure server endpoint
-- (server endpoints should use service role, so this remains conservative). If you want to allow users to see their own sessions
-- via JWT with their user id, uncomment and adapt the policy below.
--
-- DROP POLICY IF EXISTS refresh_tokens_owner_or_service ON fitbuddyai_refresh_tokens;
-- CREATE POLICY refresh_tokens_owner_or_service
--   ON fitbuddyai_refresh_tokens
--   FOR SELECT
--   USING (current_setting('jwt.claims.sub', true) = user_id OR current_setting('jwt.claims.role', true) = 'service');

-- Indexes (if not already created)
CREATE INDEX IF NOT EXISTS idx_fitbuddyai_refresh_tokens_user_id ON fitbuddyai_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fitbuddyai_refresh_tokens_created_at ON fitbuddyai_refresh_tokens(created_at);

-- Notes:
-- To call the table from server-side code, use your Supabase service role key so that RLS allows the operation.
-- Keep the service role key strictly server-side and never expose it to clients.
