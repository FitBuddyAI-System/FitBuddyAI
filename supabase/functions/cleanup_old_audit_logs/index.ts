// Supabase Edge Function template to call cleanup_old_audit_logs
// Deploy using Supabase CLI `supabase functions deploy cleanup_old_audit_logs`
// Then schedule it via Supabase Scheduled Functions in the dashboard.

// This file targets the Supabase Edge Functions runtime which provides global fetch and
// environment variables via globalThis.process?.env or Deno.env in some setups.

export async function handler(req: Request): Promise<Response> {
  const env = (globalThis as any).process?.env || (globalThis as any).__env || {};
  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', { status: 500 });
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cleanup_old_audit_logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ days: 90 })
  });

  if (!res.ok) {
    const txt = await res.text();
    return new Response(`Error invoking cleanup: ${res.status} ${txt}`, { status: 500 });
  }

  return new Response('cleanup_old_audit_logs executed');
}

