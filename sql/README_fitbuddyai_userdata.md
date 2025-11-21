fitbuddyai_userdata — Creation & usage notes

This file describes the recommended table `fitbuddyai_userdata` and how to apply the SQL creation script.

Files created:
- `sql/create_fitbuddyai_userdata.sql` — SQL that creates the table, index, trigger, and RLS policies.

How to run

- From psql (local DB):

```bash
psql "postgres://<user>:<pass>@<host>:<port>/<db>" -f sql/create_fitbuddyai_userdata.sql
```

- From Supabase SQL editor: paste the contents of `sql/create_fitbuddyai_userdata.sql` into the SQL editor and run.

Important notes

- RLS & JWT claims
  - The script enables Row Level Security and creates policies that rely on the Postgres `current_setting('jwt.claims.sub', true)` and `current_setting('jwt.claims.role', true)` values.
  - Supabase populates JWT claims for authenticated requests. When issuing requests to Supabase from the client, the database sees the JWT claims for the connected user.
  - Server-side (service) operations should use the Supabase "service role" key; the service role bypasses RLS.

- Email uniqueness
  - The script creates a case-insensitive unique index on `lower(email)` to help prevent duplicate accounts using different casing. If you prefer not to enforce email uniqueness at DB level, remove that index line.

- Inventory, chat_history, payload
  - These columns are `jsonb` typed. The application expects arrays/objects. Adjust defaults if you prefer `NULL` instead of empty JSON arrays.

- Testing
  - After creating the table, test the RLS behavior by performing queries as a regular user (client token) and as the service role to validate ownership checks.

Suggested next steps

- Add migrations to convert existing `app_users` and `user_data` rows into this table (if needed).
- Update any SQL migrations or policies in `sql/` to reference `fitbuddyai_userdata` instead of `app_users` / `user_data` where appropriate.
- Backup existing data before running destructive operations.
