import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

function requireAdmin(req) {
  const adminToken = process.env.ADMIN_API_TOKEN;
  const auth = String(req.headers['authorization'] || req.headers['Authorization'] || '');
  if (!adminToken) return true; // if no token configured, allow (use with care in dev)
  return auth === `Bearer ${adminToken}`;
}

function missingSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return !url || !key;
}

// Initialize Supabase admin client lazily
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    return createClient(url, key, { auth: { persistSession: false } });
  } catch (e) {
    console.warn('[adminRoutes] Failed to create Supabase client', e);
    return null;
  }
}

router.use(express.json());

router.all('/api/admin/users', async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ message: 'Forbidden' });

  if (missingSupabaseEnv()) {
    console.error('[api/admin/users] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ message: 'Supabase admin not configured on server. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ message: 'Failed to create Supabase admin client' });

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin.from('app_users').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error('[api/admin/users] GET error', error);
        return res.status(500).json({ message: 'Failed to fetch users', detail: error.message });
      }
      return res.json({ users: data || [] });
    }

    const action = req.query.action;
    const body = req.body || {};

    if (req.method === 'POST' && action === 'ban') {
      const { userId } = body;
      const { error } = await supabaseAdmin.from('app_users').update({ banned: true }).eq('id', userId);
      if (error) throw error;
      return res.json({ ok: true });
    }

    if (req.method === 'POST' && action === 'unban') {
      const { userId } = body;
      const { error } = await supabaseAdmin.from('app_users').update({ banned: false }).eq('id', userId);
      if (error) throw error;
      return res.json({ ok: true });
    }

    if (req.method === 'DELETE' && action === 'delete') {
      const { userId } = body;
      const { error } = await supabaseAdmin.from('app_users').delete().eq('id', userId);
      if (error) throw error;
      return res.json({ ok: true });
    }

    if (req.method === 'POST' && action === 'restore_plan') {
      const { planId } = body;
      const { error } = await supabaseAdmin.from('workout_plans').update({ deleted: false }).eq('id', planId);
      if (error) throw error;
      return res.json({ ok: true });
    }

    if (req.method === 'POST' && action === 'ban_username') {
      const { username } = body;
      const { error } = await supabaseAdmin.from('banned_usernames').insert({ username });
      if (error) throw error;
      return res.json({ ok: true });
    }

    if (req.method === 'POST' && action === 'unban_username') {
      const { username } = body;
      const { error } = await supabaseAdmin.from('banned_usernames').delete().eq('username', username);
      if (error) throw error;
      return res.json({ ok: true });
    }

    return res.status(400).json({ message: 'Bad request' });
  } catch (err) {
    console.error('[api/admin/users] Uncaught error', err?.message || err, err?.stack || 'no-stack');
    res.status(500).json({ message: 'Server error', detail: err?.message || String(err) });
  }
});

export default router;
