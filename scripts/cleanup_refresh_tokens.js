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
      // Fallback: attempt to replicate the SQL cleanup logic via REST:
      // 1) delete expired tokens immediately (expires_at < now)
      // 2) delete revoked tokens older than revoked_retention_days (default 1)
      // 3) delete non-revoked tokens older than `days` (and not already expired)
      const revokedRetentionDays = Number(process.argv[3] || 1);
      const nowIso = new Date().toISOString();
      const thresholdDays = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const thresholdRevoked = new Date(Date.now() - revokedRetentionDays * 24 * 60 * 60 * 1000).toISOString();

      // 1) delete expired tokens
      const { error: delExpiredErr } = await supabase
        .from('fitbuddyai_refresh_tokens')
        .delete()
        .lt('expires_at', nowIso)
        .not('expires_at', 'is', null);
      if (delExpiredErr) {
        console.error('Fallback delete (expired tokens) failed', delExpiredErr);
        process.exit(2);
      }

      // 2) delete revoked tokens older than revoked_retention_days
      const { error: delRevokedErr } = await supabase
        .from('fitbuddyai_refresh_tokens')
        .delete()
        .eq('revoked', true)
        .lt('created_at', thresholdRevoked);
      if (delRevokedErr) {
        console.error('Fallback delete (revoked tokens) failed', delRevokedErr);
        process.exit(2);
      }

      // 3) delete non-revoked tokens older than `days` but exclude already-expired tokens
      // 3a) delete non-revoked, non-expiring tokens (expires_at IS NULL)
      const { error: delOldNullErr } = await supabase
        .from('fitbuddyai_refresh_tokens')
        .delete()
        .eq('revoked', false)
        .lt('created_at', thresholdDays)
        .is('expires_at', null);
      if (delOldNullErr) {
        console.error('Fallback delete (old non-revoked, non-expiring tokens) failed', delOldNullErr);
        process.exit(2);
      }

      // 3b) delete non-revoked tokens older than `days` that have not yet expired (expires_at >= now)
      const { error: delOldGteErr } = await supabase
        .from('fitbuddyai_refresh_tokens')
        .delete()
        .eq('revoked', false)
        .lt('created_at', thresholdDays)
        .gte('expires_at', nowIso);
      if (delOldGteErr) {
        console.error('Fallback delete (old non-revoked tokens with future expiry) failed', delOldGteErr);
        process.exit(2);
      }

      console.log('Fallback cleanup succeeded');
      process.exit(0);
    }
    console.log('Cleanup RPC result:', data);
  } catch (e) {
    console.error('Cleanup failed', e);
    process.exit(2);
  }
}
run().catch((err) => {
  console.error('Unexpected error in cleanup script', err);
  process.exit(2);
});
