-- Migration: ensure emails in app_users are unique (case-insensitive)
-- Creates a unique index on lower(email) to prevent duplicate accounts differing by case.
-- Safe to re-run: CREATE INDEX IF NOT EXISTS is used.

-- Note: if your existing data contains duplicates (case-insensitive), this migration will fail.
-- Run a cleanup to deduplicate before applying in production.

DO $$
BEGIN
  -- create a unique index on normalized (lowercase) email to enforce uniqueness
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'app_users_email_unique_idx'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX app_users_email_unique_idx ON app_users (LOWER(email));';
  END IF;
END$$;
