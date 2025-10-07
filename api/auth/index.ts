import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const SUPABASE_URL = process.env.SUPABASE_URL as string | undefined;
const SUPABASE_KEY = process.env.SUPABASE_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[api/auth/index] Missing SUPABASE_URL or SUPABASE_KEY in environment; auth actions will fail');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

export default async function handler(req: any, res: any) {
  // Set CORS headers for Vercel / browser requests
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  const action = String(req.query?.action || '').toLowerCase();
  // Fail fast if Supabase server envs are not configured
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[api/auth/index] Supabase envs missing on request');
    return res.status(500).json({ message: 'Supabase not configured on server. Set SUPABASE_URL and SUPABASE_KEY.' });
  }
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    if (action === 'signin') {
      const { email, password } = req.body as { email: string; password: string };
      if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });
      const { data } = await supabase.from('app_users').select('*').eq('email', email).limit(1).maybeSingle();
      const user = data as any;
      if (!user || user.password !== password) return res.status(401).json({ message: 'Invalid email or password.' });
      const safeUser = { id: user.id, email: user.email, username: user.username, energy: user.energy, streak: user.streak, role: user.role };
      // Issue a local JWT for server-side verification when Supabase token is not used
      const jwtSecret = process.env.JWT_SECRET || 'dev_secret_change_me';
      let token: string | null = null;
      try {
        token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' });
      } catch (e) {
        console.warn('[api/auth/index] failed to sign jwt', e);
        token = null;
      }
      return res.json({ user: safeUser, token });
    }

    if (action === 'signup') {
      const { email, username, password } = req.body as { email: string; username: string; password: string };
      if (!email || !username || !password) return res.status(400).json({ message: 'All fields are required.' });
      // Normalize email for equality checks (case-insensitive)
      const normalizedEmail = String(email).trim().toLowerCase();
      // Quick existence check to return a friendly message without attempting insert
      try {
        const { data: existing } = await supabase.from('app_users').select('id,email').ilike('email', normalizedEmail).limit(1).maybeSingle();
        if (existing) return res.status(409).json({ message: 'Email already exists.' });
      } catch (e) {
        // ignore and proceed to insert; DB unique index will enforce constraint
      }

      const userId = uuidv4();
      const userRow = { id: userId, email: normalizedEmail, username, password, avatar: '', energy: 100, streak: 0, inventory: [] };
      const { error } = await supabase.from('app_users').insert(userRow);
      if (error) {
        // Supabase returns Postgres error details; detect unique violation (23505) or text mentioning 'unique'/'duplicate'
        const pgCode = (error as any)?.code || (error as any)?.details || null;
        const msg = (error as any)?.message || String(error);
        console.error('Supabase insert error:', error);
        if (String(msg).toLowerCase().includes('unique') || String(pgCode) === '23505') {
          return res.status(409).json({ message: 'Email already exists.' });
        }
        return res.status(500).json({ message: 'Failed to create user.' });
      }
      const safeUser = { id: userId, email, username, avatar: '', energy: 100, streak: 0, inventory: [], role: 'basic_member' };
      return res.status(201).json({ user: safeUser });
    }

    // Create profile for an existing auth user (used after Supabase auth.signUp client flow)
    if (action === 'create_profile') {
      const { id, email, username } = req.body as { id: string; email: string; username: string };
      if (!id || !email || !username) return res.status(400).json({ message: 'id, email and username required.' });
      try {
        // Insert into app_users with provided id (id comes from Supabase auth user)
        const userRow = { id, email: String(email).trim().toLowerCase(), username, avatar: '', energy: 100, streak: 0, inventory: [] };
        const { error: uErr } = await supabase.from('app_users').upsert(userRow, { onConflict: 'id' as any });
        if (uErr) console.warn('[api/auth/create_profile] app_users upsert error', uErr);

        // Insert initial user_data row (json payloads), ignore error but log
        try {
          const userDataRow: any = { id, payload: {}, chat_history: [], accepted_privacy: false, accepted_terms: false, updated_at: new Date().toISOString() };
          const { error: dErr } = await supabase.from('user_data').upsert(userDataRow, { onConflict: 'id' as any });
          if (dErr) console.warn('[api/auth/create_profile] user_data upsert error', dErr);
        } catch (inner) {
          console.warn('[api/auth/create_profile] failed to upsert user_data', inner);
        }

        return res.status(200).json({ ok: true });
      } catch (e) {
        console.error('[api/auth/create_profile] error', e);
        return res.status(500).json({ message: 'Failed to create profile.' });
      }
    }

    return res.status(404).json({ message: 'Not found' });
  } catch (err: any) {
    console.error('[api/auth/index] error', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}
