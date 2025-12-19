-- Migration 002: create fitbuddyai_refresh_tokens table
-- Idempotent: safe to re-run

-- Ensure pgcrypto is available for gen_random_uuid()
create extension if not exists pgcrypto;

create table if not exists fitbuddyai_refresh_tokens (
  id uuid default gen_random_uuid() primary key,
  session_id text not null unique,
  user_id text not null,
  refresh_token text not null,
  created_at timestamptz default now(),
  last_used timestamptz default now(),
  expires_at timestamptz,
  revoked boolean default false
);

create index if not exists idx_fitbuddyai_refresh_tokens_user_id on fitbuddyai_refresh_tokens(user_id);
create index if not exists idx_fitbuddyai_refresh_tokens_created_at on fitbuddyai_refresh_tokens(created_at);

-- Cleanup function: remove revoked tokens after a short window (default 1 day), and expired tokens after given days
create or replace function cleanup_old_refresh_tokens(days integer default 30, revoked_retention_days integer default 1)
returns void language plpgsql as $$
begin
  -- Delete revoked tokens older than revoked_retention_days
  delete from fitbuddyai_refresh_tokens
    where revoked = true
      and created_at < now() - (revoked_retention_days || ' days')::interval;

  -- Delete expired tokens immediately when they expire (regardless of creation time)
  delete from fitbuddyai_refresh_tokens
    where expires_at is not null
      and expires_at < now();

  -- Delete non-revoked tokens older than the configured retention `days`.
  -- This keeps recently-expired tokens (handled above) from being double-checked
  -- and ensures the `days` parameter applies as a retention window for still-valid
  -- or non-expiring tokens rather than gating deletion of already-expired tokens.
  delete from fitbuddyai_refresh_tokens
    where revoked = false
      and created_at < now() - (days || ' days')::interval
      and (expires_at is null or expires_at >= now());
end;
$$;

-- Rotation helper: mark all tokens for a user as revoked (useful when issuing a new token)
create or replace function revoke_user_refresh_tokens(p_user_id text)
returns void language plpgsql as $$
begin
  update fitbuddyai_refresh_tokens set revoked = true where user_id = p_user_id;
end;
$$;
