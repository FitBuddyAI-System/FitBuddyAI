import { isAdminRequest } from '../../src/services/adminAuth';
import { createClient } from '@supabase/supabase-js';

async function getAdminClient() {
  // try dynamic import of shared admin client to avoid top-level evaluation errors
  try {
    const mod = await import('../../src/services/supabaseAdminClient');
    const imported = mod && mod.supabaseAdmin ? mod.supabaseAdmin : null;
    if (imported) return imported;
  } catch (e) {
    // dynamic import failed; continue to try env-based creation
    console.warn('[api/admin/index] dynamic import of supabaseAdminClient failed', String(e));
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch (e) {
    console.warn('[api/admin/index] failed to create supabase admin client', String(e));
    return null;
  }
}

export default async function handler(req: any, res: any) {
  try {
    // verify authorization using centralized helper
    const authRes = await isAdminRequest(req);
    if (!authRes?.ok) {
      const diag = {
        auth_ok: false,
        auth_reason: authRes?.reason || null,
        env_ADMIN_API_TOKEN_present: Boolean(process.env.ADMIN_API_TOKEN),
        env_SUPABASE_URL_present: Boolean(process.env.SUPABASE_URL),
        env_SUPABASE_KEY_present: Boolean(process.env.SUPABASE_KEY),
        env_SUPABASE_SERVICE_ROLE_KEY_present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
      };
      return res.status(403).json({ message: 'Forbidden', diagnostic: diag });
    }

    const supabaseAdmin = await getAdminClient();
    if (!supabaseAdmin) {
      const diag = {
        auth_ok: Boolean(authRes?.ok),
        auth_userId: authRes?.userId || null,
        env_SUPABASE_URL_present: Boolean(process.env.SUPABASE_URL),
        env_SUPABASE_SERVICE_ROLE_KEY_present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        env_SUPABASE_KEY_present: Boolean(process.env.SUPABASE_KEY),
        message: 'Supabase admin client unavailable'
      };
      return res.status(500).json({ message: 'Supabase admin client unavailable', diagnostic: diag });
    }

    const action = req.query?.action || null;
    const actionStr = action ? String(action).toLowerCase() : '';

    if (req.method === 'GET' && (actionStr === '' || actionStr === 'users')) {
      if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') {
        console.error('[api/admin/index] supabaseAdmin not available for GET users');
        return res.status(500).json({ message: 'Supabase admin client unavailable' });
      }
      const { data, error } = await supabaseAdmin.from('app_users').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error('[api/admin/index] supabase error fetching users', error.message);
        const diag = { message: 'Failed to fetch users', detail: error.message };
        return res.status(500).json({ message: 'Failed to fetch users', diagnostic: diag });
      }
      const sanitized = (data || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        avatar: u.avatar,
        created_at: u.created_at,
        banned: Boolean(u.banned),
      }));
      return res.json({ users: sanitized });
    }

    const body = req.body || {};

    if (req.method === 'POST' && actionStr === 'ban') {
      const { userId } = body;
      if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') return res.status(500).json({ message: 'Supabase admin client unavailable' });
      const { error } = await supabaseAdmin.from('app_users').update({ banned: true }).eq('id', userId);
      if (error) return res.status(500).json({ message: 'Failed to ban user', detail: error.message });
      return res.json({ ok: true });
    }

    if (req.method === 'POST' && actionStr === 'unban') {
      const { userId } = body;
      if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') return res.status(500).json({ message: 'Supabase admin client unavailable' });
      const { error } = await supabaseAdmin.from('app_users').update({ banned: false }).eq('id', userId);
      if (error) return res.status(500).json({ message: 'Failed to unban user', detail: error.message });
      return res.json({ ok: true });
    }

    if (req.method === 'DELETE' && actionStr === 'delete') {
      const { userId } = body;
      if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') return res.status(500).json({ message: 'Supabase admin client unavailable' });
      const { error } = await supabaseAdmin.from('app_users').delete().eq('id', userId);
      if (error) return res.status(500).json({ message: 'Failed to delete user', detail: error.message });
      return res.json({ ok: true });
    }

    if (req.method === 'POST' && actionStr === 'restore_plan') {
      const { planId } = body;
      if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') return res.status(500).json({ message: 'Supabase admin client unavailable' });
      const { error } = await supabaseAdmin.from('workout_plans').update({ deleted: false }).eq('id', planId);
      if (error) return res.status(500).json({ message: 'Failed to restore plan', detail: error.message });
      return res.json({ ok: true });
    }

    if (actionStr === 'ban_username') {
      if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
      const { username } = body;
      if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') return res.status(500).json({ message: 'Supabase admin client unavailable' });
      const { error } = await supabaseAdmin.from('banned_usernames').insert({ username });
      if (error) return res.status(500).json({ message: 'Failed to ban username', detail: error.message });
      return res.json({ ok: true });
    }

    if (actionStr === 'unban_username') {
      if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
      const { username } = body;
      if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') return res.status(500).json({ message: 'Supabase admin client unavailable' });
      const { error } = await supabaseAdmin.from('banned_usernames').delete().eq('username', username);
      if (error) return res.status(500).json({ message: 'Failed to unban username', detail: error.message });
      return res.json({ ok: true });
    }

    return res.status(400).json({ message: 'Bad request' });
  } catch (err: any) {
    console.error('[api/admin/index] error', err?.message || err);
    return res.status(500).json({ message: 'Server error', detail: err?.message || String(err) });
  }
}
