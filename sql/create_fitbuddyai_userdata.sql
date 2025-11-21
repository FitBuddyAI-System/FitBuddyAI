-- SQL creation script for the unified user data table: fitbuddyai_userdata
-- Usage: run this in psql, Supabase SQL editor, or any Postgres client with sufficient privileges.
-- IMPORTANT: This script creates RLS policies that rely on JWT claims ("sub" and "role").
-- Ensure your Supabase JWT settings / Postgres current_setting usage are aligned with your auth tokens.

BEGIN;

-- Create the table (id is user_id UUID primary key)
CREATE TABLE IF NOT EXISTS public.fitbuddyai_userdata (
  user_id uuid PRIMARY KEY,
  email text,
  username text,
  avatar_url text,
  energy integer DEFAULT 100,
  streak integer DEFAULT 0,
  inventory jsonb DEFAULT '[]'::jsonb,
  role text DEFAULT 'basic_member',
  accepted_terms boolean DEFAULT false,
  accepted_privacy boolean DEFAULT false,
  chat_history jsonb DEFAULT '[]'::jsonb,
  workout_plan jsonb,
  questionnaire_progress jsonb,
  payload jsonb,
  banned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique index for case-insensitive email (optional, only if you want email uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS fitbuddyai_userdata_email_unique_idx
  ON public.fitbuddyai_userdata (LOWER(email))
  WHERE email IS NOT NULL;

-- Trigger function to update updated_at
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to update updated_at on update
DROP TRIGGER IF EXISTS set_timestamp_fitbuddyai_userdata ON public.fitbuddyai_userdata;
CREATE TRIGGER set_timestamp_fitbuddyai_userdata
BEFORE UPDATE ON public.fitbuddyai_userdata
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Enable Row Level Security (RLS) so policies can be enforced
ALTER TABLE public.fitbuddyai_userdata ENABLE ROW LEVEL SECURITY;

-- Policy: allow read/update/delete for owner (jwt.sub) or when calling role is 'service'
DROP POLICY IF EXISTS fitbuddyai_userdata_owner_or_service ON public.fitbuddyai_userdata;
CREATE POLICY fitbuddyai_userdata_owner_or_service
  ON public.fitbuddyai_userdata
  USING (
    -- allow when JWT "sub" equals user_id
    (current_setting('jwt.claims.sub', true) IS NOT NULL AND user_id = (current_setting('jwt.claims.sub', true))::uuid)
    OR
    -- or when client's role claim is the service role
    (current_setting('jwt.claims.role', true) = 'service')
  )
  WITH CHECK (
    -- For writes, same constraints: allow write only if owner or service
    (current_setting('jwt.claims.sub', true) IS NOT NULL AND user_id = (current_setting('jwt.claims.sub', true))::uuid)
    OR
    (current_setting('jwt.claims.role', true) = 'service')
  );

-- Policy: allow insert when the new row's user_id equals jwt.sub or caller has service role
DROP POLICY IF EXISTS fitbuddyai_userdata_insert_owner_or_service ON public.fitbuddyai_userdata;
CREATE POLICY fitbuddyai_userdata_insert_owner_or_service
  ON public.fitbuddyai_userdata FOR INSERT
  WITH CHECK (
    (current_setting('jwt.claims.sub', true) IS NOT NULL AND user_id = (current_setting('jwt.claims.sub', true))::uuid)
    OR (current_setting('jwt.claims.role', true) = 'service')
  );

-- Optionally you can add specific admin/select policies to allow admin users to list users
-- Example: allow select if jwt claim role = 'admin' OR service
DROP POLICY IF EXISTS fitbuddyai_userdata_select_admin ON public.fitbuddyai_userdata;
CREATE POLICY fitbuddyai_userdata_select_admin
  ON public.fitbuddyai_userdata FOR SELECT
  USING (
    (current_setting('jwt.claims.role', true) = 'admin') OR (current_setting('jwt.claims.role', true) = 'service')
  );

COMMIT;

-- Notes:
-- - The policies above assume JWT claims are set using current_setting('jwt.claims.*', true).
--   This is the default behavior in Supabase when using its JWT/Auth integration.
-- - If your environment does not use JWT claims in the DB connection (e.g., running as a service-role key),
--   the service role will bypass RLS automatically. Use the service role for server-side admin operations.
-- - Make sure to review RLS policies and tailor them to your security requirements before exposing to production.
