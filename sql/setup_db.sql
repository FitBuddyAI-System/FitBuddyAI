-- Run this in the Supabase SQL editor (or psql connected to your database)

-- audit_logs table for AI action audit and general events
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

-- banned_usernames simple table
create table if not exists banned_usernames (
  username text primary key,
  created_at timestamptz default now()
);

-- workout_plans table with deleted flag so admins can restore
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

-- If you use both app_users and users in code, create a view for convenience
create or replace view users as
  select id, email, username, role, avatar, energy, streak, false as banned
  from app_users;

-- Optional: ensure app_users has role column
alter table app_users
  add column if not exists role text not null default 'basic_member';

-- Enable Row Level Security and create policies for audit_logs
alter table audit_logs enable row level security;
-- Allow inserts only from authenticated server role (service role)
drop policy if exists audit_logs_insert_server_only on audit_logs;
create policy audit_logs_insert_server_only
  on audit_logs
  for insert
  with check (
    -- adapt to your JWT claim or service role; example uses jwt.claims.role
    current_setting('jwt.claims.role', true) = 'service'
  );

-- Allow admins to select
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

-- If you don't have auth.role()/auth.uid() available, you can alternatively restrict by RLS to a specific JWT claim, e.g. `jwt.claims.role = 'service'`.

-- Cleanup function: delete logs older than X days
create or replace function cleanup_old_audit_logs(days integer default 90)
returns void language plpgsql as $$
begin
  delete from audit_logs where timestamp < now() - (days || ' days')::interval;
end;
$$;

-- Note: schedule `cleanup_old_audit_logs()` using Supabase Scheduled Functions or external cron to run periodically.

-- Enable RLS for user_data and allow owner or service role access
alter table if exists user_data enable row level security;
drop policy if exists user_data_owner_or_service on user_data;
create policy user_data_owner_or_service
  on user_data
  for all
  using (
    (
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
