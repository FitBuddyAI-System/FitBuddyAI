Migration script: migrate_app_users_to_supabase.js

This repository contains a utility script to create Supabase Auth users for existing rows in the `app_users` table.

Important safety notes
- The script is non-destructive by default and will NOT delete or modify rows in `app_users` unless you explicitly run it with `--confirm`.
- Always run this script with the Supabase service-role key in a secure environment (do not commit the key).

Usage (PowerShell)

# Dry-run (default): shows what would be created and writes a `migrated_auth_users.json` with planned accounts
$env:SUPABASE_URL='https://<project>.supabase.co'; $env:SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'; node .\scripts\migrate_app_users_to_supabase.js

# Confirm and create Auth users (creates accounts, writes created users to file)
$env:SUPABASE_URL='https://<project>.supabase.co'; $env:SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'; node .\scripts\migrate_app_users_to_supabase.js --confirm --output created_auth_users.json

Output
- The script writes a JSON file (default `migrated_auth_users.json`) containing the emails and temporary passwords (when required). Review this file and notify users to reset their passwords if needed.

Security
- Keep the `SUPABASE_SERVICE_ROLE_KEY` secret. Run this only on a trusted machine or CI with secrets masked.
