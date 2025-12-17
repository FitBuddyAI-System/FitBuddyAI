/* Cleanup script: call Supabase RPC cleanup_old_refresh_tokens or use REST endpoint
   Usage: node scripts/cleanup_refresh_tokens.js [days]
   Requires env: SUPABASE_URL, SUPABASE_KEY (service role)
*/
const { createClient } = require('@supabase/supabase-js');

const days = Number(process.argv[2] || 30);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_KEY must be set');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('Running cleanup_old_refresh_tokens for', days, 'days');
  try {
    // If you added the plpgsql function cleanup_old_refresh_tokens, call it via RPC
    const { data, error } = await supabase.rpc('cleanup_old_refresh_tokens', { days });
    if (error) {
      console.error('RPC cleanup error', error);
      // Fallback: delete via SQL using supabase.from
      const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { error: delErr } = await supabase.from('fitbuddyai_refresh_tokens').delete().lt('created_at', threshold);
      if (delErr) {
        console.error('Fallback delete failed', delErr);
        process.exit(2);
      }
      console.log('Fallback delete succeeded');
      process.exit(0);
    }
    console.log('Cleanup RPC result:', data);
  } catch (e) {
    console.error('Cleanup failed', e);
    process.exit(2);
  }
}
run();
