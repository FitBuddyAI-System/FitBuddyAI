#!/usr/bin/env node
/*
  scripts/migrate_app_users_to_supabase.js

  Run this locally (or on a secure server) to create Supabase Auth users for
  existing rows in the `app_users` table. This script requires the following
  environment variables to be set (in a .env file or the environment):

    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY

  WARNING: The service role key is powerful and MUST NOT be committed or
  exposed to clients. Run this script only in a trusted environment.

  Usage:
    node scripts/migrate_app_users_to_supabase.js

*/

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment. Aborting.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function randomPassword() {
  return [...Array(12)].map(() => (Math.random().toString(36)[2] || 'a')).join('') + 'A1!';
}

async function fetchAppUsers() {
  const { data, error } = await supabase.from('fitbuddyai_userdata').select('user_id as id,email,password,username,avatar_url as avatar,energy').limit(2000);
  if (error) throw error;
  return data || [];
}

async function authUserExists(email) {
  // Use Admin list by email via REST admin endpoint
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY
    }
  });
  if (!res.ok) return false;
  try {
    const json = await res.json();
    return Array.isArray(json) ? json.length > 0 : false;
  } catch {
    return false;
  }
}

async function createAuthUser(row) {
  // Create via admin endpoint
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`;
  const password = row.password && String(row.password).length >= 6 ? row.password : randomPassword();
  const body = {
    email: row.email,
    password,
    user_metadata: {
      username: row.username || null,
      avatar: row.avatar || null,
      energy: row.energy ?? null
    }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Failed to create auth user for ${row.email}: ${res.status} ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    return { raw: text };
  }
}

async function main() {
  try {
  const args = process.argv.slice(2);
  const confirm = args.includes('--confirm');
  const autoConfirm = args.includes('--auto-confirm') || args.includes('--confirm-email');
  const outIdx = args.findIndex(a => a === '--output');
  const outFile = outIdx >= 0 && args[outIdx + 1] ? args[outIdx + 1] : 'migrated_auth_users.json';

    console.log('NOTE: This script is non-destructive by default. It will NOT delete or modify rows in fitbuddyai_userdata.');
    if (!confirm) console.log('Running in dry-run mode. Use --confirm to actually create Auth users.');

    console.log('Fetching fitbuddyai_userdata rows...');
    const rows = await fetchAppUsers();
    console.log(`Found ${rows.length} rows in fitbuddyai_userdata`);

    const results = { created: [], skipped: [], failed: [] };
    for (const r of rows) {
      if (!r.email) {
        results.failed.push({ id: r.id, reason: 'no email' });
        console.warn('Skipping user with no email', r.id);
        continue;
      }
      try {
        const exists = await authUserExists(r.email);
        if (exists) {
          results.skipped.push(r.email);
          console.log('Auth user already exists, skipping:', r.email);
          continue;
        }
        const password = r.password && String(r.password).length >= 6 ? r.password : randomPassword();
        if (!confirm) {
          // Dry-run: don't create, but record what would be created
          results.created.push({ email: r.email, password, note: 'dry-run' });
          console.log('[dry-run] Would create auth user for', r.email);
          continue;
        }
        const created = await createAuthUser({ ...r, password });
        // created may contain the created user object; push the minimal shape
        results.created.push({ email: r.email, created });
        console.log('Created auth user for', r.email);

        if (autoConfirm) {
          try {
            // Attempt to mark the user email as confirmed using the admin update endpoint.
            const userId = (created && (created.id || created.user?.id)) || null;
            if (userId) {
              const patchUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(userId)}`;
              const patchBody = { email_confirm: true, email_confirmed_at: new Date().toISOString() };
              const patchRes = await fetch(patchUrl, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
                  apikey: SERVICE_ROLE_KEY
                },
                body: JSON.stringify(patchBody)
              });
              if (patchRes.ok) {
                console.log('Auto-confirmed email for', r.email);
              } else {
                const txt = await patchRes.text();
                console.warn('Auto-confirm failed for', r.email, patchRes.status, txt.slice ? txt.slice(0, 200) : txt);
              }
            } else {
              console.warn('Could not determine user id for auto-confirm of', r.email);
            }
          } catch (e) {
            console.warn('Auto-confirm step threw for', r.email, e?.message || e);
          }
        }
      } catch (err) {
        console.error('Failed for', r.email, err?.message || err);
        results.failed.push({ email: r.email, error: String(err) });
      }
    }

    console.log('Migration complete. Summary:');
    console.log('Created (or planned):', results.created.length, 'Skipped:', results.skipped.length, 'Failed:', results.failed.length);
    if (results.failed.length) console.log('Failures sample:', results.failed.slice(0, 5));

    // If confirmed and there are created entries, persist a record with minimal details (email and temp password)
    if (confirm && results.created.length) {
      try {
        const outPath = path.resolve(process.cwd(), outFile);
        const minimal = results.created.map(c => ({ email: c.email, password: c.created?.password || (c.password || null) }));
        fs.writeFileSync(outPath, JSON.stringify(minimal, null, 2), { encoding: 'utf8', flag: 'w' });
        console.log('Wrote created users info to', outPath);
      } catch (e) {
        console.warn('Failed to write output file', e);
      }
    } else if (!confirm && results.created.length) {
      // For dry-run write planned creations to the output file so operator can review
      try {
        const outPath = path.resolve(process.cwd(), outFile);
        const minimal = results.created.map(c => ({ email: c.email, password: c.password || null, note: c.note || null }));
        fs.writeFileSync(outPath, JSON.stringify(minimal, null, 2), { encoding: 'utf8', flag: 'w' });
        console.log('Wrote dry-run planned creations to', outPath);
      } catch (e) {
        console.warn('Failed to write dry-run output file', e);
      }
    }
  } catch (err) {
    console.error('Migration error', err);
    process.exit(1);
  }
}

main();
