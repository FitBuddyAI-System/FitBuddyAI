-- Migration: create audit_logs, banned_usernames, workout_plans and RLS policies (idempotent)
-- Run this migration in order. This file is safe to re-run because of IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR REPLACE.

create table if not exists audit_logs (
  id bigserial primary key,
  timestamp timestamptz default now(),
  user_id text,
  event text,
  action jsonb,
  ip text,
  user_agent text,
  verified boolean default false
);

create table if not exists banned_usernames (
  username text primary key,
  created_at timestamptz default now()
);

create table if not exists workout_plans (
  id uuid primary key,
  name text,
  description text,
  owner_id text,
  payload jsonb,
  deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace view users as
  select id, email, username, role, avatar, energy, streak, false as banned
  from app_users;

alter table app_users
  add column if not exists role text not null default 'basic_member';

alter table audit_logs enable row level security;
-- Configure RLS policies for audit_logs. IMPORTANT: adjust the JWT claim names below to match
-- what your Supabase project's JWTs actually include. Common claim names:
--  - jwt.claims.role  (single role string)
--  - jwt.claims.roles (array string or json list)
--  - jwt.claims.sub   (user id / subject)
--
-- Example INSERT policy variants (choose one and adapt to your token claims):
-- Variant A (recommended if your service role is exposed as jwt.claims.role = 'service'):
--   with check ( current_setting('jwt.claims.role', true) = 'service' )
-- Variant B (if your tokens include an array of roles in jwt.claims.roles):
--   with check ( current_setting('jwt.claims.roles', true)::text like '%service%' )
-- Variant C (if your environment exposes auth.role() helper and returns 'service_role'):
--   with check ( auth.role() = 'service_role' )

-- Insert policy: only allow inserts when the JWT claim `role` equals 'service' (adjust to your claims)
drop policy if exists audit_logs_insert_server_only on audit_logs;
create policy audit_logs_insert_server_only
  on audit_logs
  for insert
  with check (
    current_setting('jwt.claims.role', true) = 'service'
  );

-- Select policy: only allow selects if app_users.role = 'admin' for the calling user
drop policy if exists audit_logs_select_admin on audit_logs;
create policy audit_logs_select_admin
  on audit_logs
  for select
  using (
    exists (
      select 1 from app_users
  where app_users.id = current_setting('jwt.claims.sub', true)::uuid
        and app_users.role = 'admin'
    )
  );

-- Enable RLS and policies for app_users
alter table app_users enable row level security;
drop policy if exists app_users_select_admin on app_users;
create policy app_users_select_admin
  on app_users
  for select
  using (app_users.id = current_setting('jwt.claims.sub', true)::uuid or current_setting('jwt.claims.role', true) = 'service');

drop policy if exists app_users_update_admin on app_users;
create policy app_users_update_admin
  on app_users
  for update
  using (current_setting('jwt.claims.role', true) = 'service' or app_users.id = current_setting('jwt.claims.sub', true)::uuid)
  with check (true);

-- workout_plans RLS
alter table workout_plans enable row level security;
drop policy if exists workout_plans_owner_or_admin on workout_plans;
create policy workout_plans_owner_or_admin
  on workout_plans
  for all
  using (owner_id = current_setting('jwt.claims.sub', true) or current_setting('jwt.claims.role', true) = 'service')
  with check (owner_id = current_setting('jwt.claims.sub', true) or current_setting('jwt.claims.role', true) = 'service');

-- banned_usernames RLS
alter table banned_usernames enable row level security;
drop policy if exists banned_usernames_manage_service on banned_usernames;
create policy banned_usernames_manage_service
  on banned_usernames
  for all
  using (current_setting('jwt.claims.role', true) = 'service')
  with check (current_setting('jwt.claims.role', true) = 'service');

-- user_data RLS
-- Protect per-user payloads. Allow the owning user (matching jwt.claims.sub)
-- or the backend 'service' role to select/insert/update/delete rows.
alter table if exists user_data enable row level security;
drop policy if exists user_data_owner_or_service on user_data;
create policy user_data_owner_or_service
  on user_data
  for all
  using (
    (
      -- match common cases: direct text equality OR jwt sub as uuid cast back to text
      user_data.user_id = current_setting('jwt.claims.sub', true)
      or user_data.user_id = current_setting('jwt.claims.sub', true)::uuid::text
      or current_setting('jwt.claims.role', true) = 'service'
    )
  )
  with check (
    (
      user_data.user_id = current_setting('jwt.claims.sub', true)
      or user_data.user_id = current_setting('jwt.claims.sub', true)::uuid::text
      or current_setting('jwt.claims.role', true) = 'service'
    )
  );

-- Cleanup function
create or replace function cleanup_old_audit_logs(days integer default 90)
returns void language plpgsql as $$
begin
  delete from audit_logs where timestamp < now() - (days || ' days')::interval;
end;
$$;
