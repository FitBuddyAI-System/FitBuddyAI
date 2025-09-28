import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string | undefined;
const SUPABASE_KEY = process.env.SUPABASE_KEY as string | undefined;

const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[api/user/update] Missing SUPABASE_URL or SUPABASE_KEY in environment');
    return res.status(500).json({ message: 'Supabase not configured on server. Set SUPABASE_URL and SUPABASE_KEY.' });
  }

  try {
    const { id, username, avatar } = req.body || {};
    if (!id) return res.status(400).json({ message: 'User id required.' });

    const updates: any = {};
    if (typeof username === 'string') updates.username = username;
    if (typeof avatar === 'string') updates.avatar = avatar;

    if (Object.keys(updates).length === 0) return res.status(400).json({ message: 'No fields to update.' });

    const { data, error } = await supabase.from('app_users').update(updates).eq('id', id).select().maybeSingle();
    if (error) {
      console.error('[api/user/update] Supabase update error', error);
      return res.status(500).json({ message: 'Failed to update user.', detail: error.message });
    }
    if (!data) return res.status(404).json({ message: 'User not found.' });

    // Remove sensitive fields
    const { password, ...userSafe } = data as any;
    return res.json({ user: userSafe });
  } catch (err: any) {
    console.error('[api/user/update] error', err);
    return res.status(500).json({ message: 'Server error', detail: String(err) });
  }
}

