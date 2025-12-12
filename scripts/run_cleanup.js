#!/usr/bin/env node
// Run cleanup_old_audit_logs from the command line using SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL env vars.
// Usage (PowerShell): $env:SUPABASE_URL='https://...'; $env:SUPABASE_SERVICE_ROLE_KEY='...'; node scripts/run_cleanup.js 90

import { createClient } from '@supabase/supabase-js';

const daysArg = process.argv[2] || '90';
const days = parseInt(daysArg, 10);
if (Number.isNaN(days)) {
  console.error('Invalid days argument. Provide an integer, e.g. 90');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  console.log(`Running cleanup_old_audit_logs(${days})`);
  const { data: _data, error } = await supabase.rpc('cleanup_old_audit_logs', { days });
  if (error) {
    console.error('Error running cleanup:', error);
    process.exit(1);
  }
  console.log('Cleanup executed successfully.');
}

run();
