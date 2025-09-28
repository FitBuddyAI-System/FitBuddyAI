import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string | undefined;
const SUPABASE_KEY = process.env.SUPABASE_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[api/user/index] Missing SUPABASE_URL or SUPABASE_KEY in environment');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const id = String(req.query?.id || req.body?.id || '');
    if (!id) return res.status(400).json({ message: 'User id required.' });

    if (req.method === 'GET') {
      const { data, error } = await supabase.from('app_users').select('*').eq('id', id).limit(1).maybeSingle();
      if (error) {
        console.error('[api/user/index] supabase error', error);
        return res.status(500).json({ message: 'Supabase error.' });
      }
      if (!data) return res.status(404).json({ message: 'User not found.' });
      const { password, ...safe } = data as any;
      return res.status(200).json({ user: safe });
    }

    if (req.method === 'POST') {
      const action = String(req.query?.action || req.body?.action || '').toLowerCase();
      if (action === 'workout_plan') {
        // In this project the workout plan is stored in server/user_data or proxied via userdata handler.
        // Forward to userdata admin endpoint if present.
        // Minimal implementation: return 404 to mirror previous behavior.
        return res.status(404).json({ message: 'No workout plan found.' });
      }
      if (action === 'assessment') {
        return res.status(404).json({ message: 'No assessment found.' });
      }
      if (action === 'update') {
        // Update a user's basic profile (username, avatar). Accepts body { id, username, avatar }
        const body = req.body || {};
        const uid = String(body.id || id || '');
        if (!uid) return res.status(400).json({ message: 'User id required for update.' });
        const updates: any = {};
        if (body.username !== undefined) updates.username = body.username;
        if (body.avatar !== undefined) updates.avatar = body.avatar;
        if (Object.keys(updates).length === 0) return res.status(400).json({ message: 'No update fields provided.' });
        const { data, error } = await supabase.from('app_users').update(updates).eq('id', uid).select().limit(1).maybeSingle();
        if (error) {
          console.error('[api/user/index] update error', error);
          return res.status(500).json({ message: 'Failed to update user.' });
        }
        const { password, ...safe } = (data as any) || {};
        return res.status(200).json({ user: safe });
      }
      return res.status(400).json({ message: 'Unsupported action.' });
    }
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (err) {
    console.error('[api/user/index] error', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}
