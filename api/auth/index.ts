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

      const { data: existing } = await supabase.from('app_users').select('id,email').eq('email', email).limit(1).maybeSingle();
      if (existing) return res.status(409).json({ message: 'Email already exists.' });

      const userId = uuidv4();
      const userRow = { id: userId, email, username, password, avatar: '', energy: 100, streak: 0, inventory: [] };
      const { error } = await supabase.from('app_users').insert(userRow);
      if (error) {
        console.error('Supabase insert error:', error);
        return res.status(500).json({ message: 'Failed to create user.' });
      }
      const safeUser = { id: userId, email, username, avatar: '', energy: 100, streak: 0, inventory: [], role: 'basic_member' };
      return res.status(201).json({ user: safeUser });
    }

    return res.status(404).json({ message: 'Not found' });
  } catch (err: any) {
    console.error('[api/auth/index] error', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}
