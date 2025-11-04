import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export async function isAdminRequest(req: any): Promise<{ ok: boolean; userId?: string; reason?: string }> {
  const adminApiToken = process.env.ADMIN_API_TOKEN;
  const authHeader = String(req.headers.authorization || req.headers.Authorization || '').replace(/^Bearer\s*/i, '') || null;

  // 1) ADMIN_API_TOKEN direct match
  if (adminApiToken && authHeader && authHeader === adminApiToken) return { ok: true };

  // 2) Supabase session token verification (recommended if SUPABASE envs present)
  const SUPABASE_URL = process.env.SUPABASE_URL as string | undefined;
  const SUPABASE_KEY = (process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY) as string | undefined;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

  if (authHeader && SUPABASE_URL && SUPABASE_KEY) {
    try {
      const client = createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data: userData, error: userErr } = await client.auth.getUser(authHeader);
      if (!userErr && userData && userData.user) {
        const uid = userData.user.id;
        // check app_users then public.users
        try {
          const { data: appRow } = await client.from('app_users').select('role').eq('id', uid).limit(1).maybeSingle();
          if (appRow && appRow.role === 'admin') return { ok: true, userId: uid };
        } catch {}
        try {
          const { data: pubRow } = await client.from('public.users').select('role').eq('id', uid).limit(1).maybeSingle();
          if (pubRow && pubRow.role === 'admin') return { ok: true, userId: uid };
        } catch {}
      }
    } catch (e) {
      // continue to other checks
    }
  }

  // 3) JWT signed with JWT_SECRET (local dev fallback)
  if (authHeader) {
    try {
      const jwtSecret = process.env.JWT_SECRET || 'dev_secret_change_me';
      const payload: any = jwt.verify(authHeader, jwtSecret);
      if (payload && (payload.role === 'admin' || (payload.roles && payload.roles.includes && payload.roles.includes('admin')))) {
        return { ok: true, userId: payload.id || undefined };
      }
    } catch (e) {
      // ignore
    }
  }

  // 4) If client supplied fitbuddyai_user_data in body, cross-check server-side DB for that id's role
  try {
    const body = req.body || {};
    const clientUser = body?.fitbuddyai_user_data?.data || body?.fitbuddyai_user_data || null;
  if (clientUser && clientUser.id && SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY)) {
      try {
    const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY as string;
    const adminClient = createClient(SUPABASE_URL as string, key as string);
        const uid = String(clientUser.id);
        try {
          const { data: appRow } = await adminClient.from('app_users').select('role').eq('id', uid).limit(1).maybeSingle();
          if (appRow && appRow.role === 'admin') return { ok: true, userId: uid };
        } catch {}
        try {
          const { data: pubRow } = await adminClient.from('public.users').select('role').eq('id', uid).limit(1).maybeSingle();
          if (pubRow && pubRow.role === 'admin') return { ok: true, userId: uid };
        } catch {}
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {}

  return { ok: false, reason: 'not_authorized' };
}

export default isAdminRequest;
