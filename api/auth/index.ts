import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const SUPABASE_URL = process.env.SUPABASE_URL as string | undefined;
const SUPABASE_KEY = process.env.SUPABASE_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[api/auth/index] Missing SUPABASE_URL or SUPABASE_KEY in environment; auth actions will fail');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

const normalizeEmail = (value: string | undefined | null): string => {
  if (!value) return '';
  return String(value).trim().toLowerCase();
};

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
const MAX_USERNAME_LENGTH = 20;

async function verifyGoogleIdToken(idToken: string) {
  const url = new URL('https://oauth2.googleapis.com/tokeninfo');
  url.searchParams.append('id_token', idToken);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Google ID token verification failed (${res.status})`);
  }
  const payload = await res.json();
  if (GOOGLE_OAUTH_CLIENT_ID && payload?.aud && payload.aud !== GOOGLE_OAUTH_CLIENT_ID) {
    throw new Error('Google ID token audience mismatch');
  }
  return payload;
}

function sanitizeUsernameCandidate(value?: string | null): string | null {
  if (!value) return null;
  let normalized = String(value).trim();
  normalized = normalized.replace(/[^A-Za-z0-9_ ]+/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  if (normalized.length > MAX_USERNAME_LENGTH) {
    normalized = normalized.slice(0, MAX_USERNAME_LENGTH).trim();
    if (!normalized) return null;
  }
  return normalized || null;
}

function deriveUsernameFromGooglePayload(payload: any): string {
  const candidates = [
    payload?.name,
    payload?.given_name,
    payload?.family_name,
    payload?.email ? payload.email.split('@')[0] : null
  ];
  for (const candidate of candidates) {
    const sanitized = sanitizeUsernameCandidate(candidate);
    if (sanitized) return sanitized;
  }
  const fallbackId = payload?.sub ? String(payload.sub).slice(0, 6) : uuidv4().slice(0, 6);
  return `fitbuddy-${fallbackId}`;
}

function buildSafeUser(row: any) {
  return {
    id: row?.user_id || row?.id,
    email: row?.email || '',
    username: row?.username || '',
    avatar: row?.avatar_url || '',
    energy: typeof row?.energy === 'number' ? row.energy : 100,
    streak: typeof row?.streak === 'number' ? row.streak : 0,
    role: row?.role || 'basic_member'
  };
}

function signJwtForRow(row: any) {
  const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
  try {
    return jwt.sign({ id: row.user_id, role: row.role || 'basic_member' }, secret, { expiresIn: '7d' });
  } catch (err) {
    console.warn('[api/auth/google_id_token] failed to sign jwt', err);
    return null;
  }
}

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
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) return res.status(400).json({ message: 'Email is required.' });
      // Look up user in fitbuddyai_userdata by email (legacy API flow)
      const { data } = await supabase.from('fitbuddyai_userdata').select('*').ilike('email', normalizedEmail).limit(1).maybeSingle();
      const user = data as any;
      if (!user || user.password !== password) return res.status(401).json({ message: 'Invalid email or password.' });
      const safeUser = { id: user.user_id || user.id, email: user.email, username: user.username, energy: user.energy, streak: user.streak, role: user.role };
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
      const normalizedEmail = normalizeEmail(email);
      // Quick existence check to return a friendly message without attempting insert
      try {
        const { data: existing } = await supabase.from('fitbuddyai_userdata').select('user_id,email').ilike('email', normalizedEmail).limit(1).maybeSingle();
        if (existing) return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Email already exists.' });
      } catch (e) {
        // ignore and proceed to insert; DB unique index will enforce constraint
      }

      const userId = uuidv4();
      // Insert into unified fitbuddyai_userdata table keyed by user_id
      const userRow = { user_id: userId, email: normalizedEmail, username, password, avatar: '', energy: 100, streak: 0, inventory: [] };
      const { error } = await supabase.from('fitbuddyai_userdata').insert(userRow);
      if (error) {
        // Supabase returns Postgres error details; detect unique violation (23505) or text mentioning 'unique'/'duplicate'
        const pgCode = (error as any)?.code || (error as any)?.details || null;
        const msg = (error as any)?.message || String(error);
        console.error('Supabase insert error:', error);
        if (String(msg).toLowerCase().includes('unique') || String(pgCode) === '23505') {
          return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Email already exists.' });
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
      const normalizedEmail = normalizeEmail(email);
      try {
        // Try to reuse existing profile for this email before creating a new one.
        const { data: existing } = await supabase
          .from('fitbuddyai_userdata')
          .select('*')
          .ilike('email', normalizedEmail)
          .limit(1)
          .maybeSingle();
        if (existing && existing.user_id) {
          const updates: any = { email: normalizedEmail };
          if (existing.username !== username && username) updates.username = username;
          if (existing.user_id !== id) updates.user_id = id;
          const matchId = existing.user_id;
          const { error: updateError } = await supabase.from('fitbuddyai_userdata').update(updates).eq('user_id', matchId);
          if (updateError) {
            console.warn('[api/auth/create_profile] failed to rebind existing profile', updateError);
            return res.status(500).json({ message: 'Failed to migrate existing profile.' });
          }
          return res.status(200).json({ ok: true, reused: true });
        }

        // No existing row: insert a new profile
        const userRow = {
          user_id: id,
          email: normalizedEmail,
          username,
          avatar: '',
          energy: 100,
          streak: 0,
          inventory: [],
          accepted_privacy: false,
          accepted_terms: false,
          chat_history: [],
          workout_plan: null,
          questionnaire_progress: null,
          banned: false,
          role: 'basic_member'
        };
        const { error: uErr } = await supabase.from('fitbuddyai_userdata').insert(userRow);
        if (uErr) {
          console.warn('[api/auth/create_profile] fitbuddyai_userdata insert error', uErr);
          return res.status(500).json({ message: 'Failed to create profile.' });
        }
        return res.status(200).json({ ok: true });
      } catch (e) {
        console.error('[api/auth/create_profile] error', e);
        return res.status(500).json({ message: 'Failed to create profile.' });
      }
    }

    if (action === 'google_id_token') {
      const { id_token } = req.body as { id_token?: string };
      if (!id_token) return res.status(400).json({ message: 'ID token required.' });
      let googlePayload: any;
      try {
        googlePayload = await verifyGoogleIdToken(id_token);
      } catch (err: any) {
        console.warn('[api/auth/google_id_token] token verification failed', err);
        return res.status(401).json({ message: err?.message || 'Invalid Google ID token.' });
      }
      const googleAccountId = String(googlePayload?.sub || '').trim();
      if (!googleAccountId) return res.status(400).json({ message: 'Google account ID missing.' });
      const normalizedEmail = normalizeEmail(googlePayload?.email);
      if (!normalizedEmail) return res.status(400).json({ message: 'Google account email is required.' });
      const usernameCandidate = deriveUsernameFromGooglePayload(googlePayload);
      let userRow: any = null;
      try {
        const { data } = await supabase
          .from('fitbuddyai_userdata')
          .select('*')
          .filter('payload->>google_account_id', 'eq', googleAccountId)
          .maybeSingle();
        if (data) userRow = data;
      } catch (err) {
        console.warn('[api/auth/google_id_token] lookup by google id failed', err);
      }
      if (!userRow) {
        try {
          const { data } = await supabase
            .from('fitbuddyai_userdata')
            .select('*')
            .ilike('email', normalizedEmail)
            .limit(1)
            .maybeSingle();
          if (data) userRow = data;
        } catch (err) {
          console.warn('[api/auth/google_id_token] lookup by email failed', err);
        }
      }
      if (userRow) {
        const mergedPayload = { ...(userRow.payload || {}), google_account_id: googleAccountId };
        const updates: any = {};
        if (JSON.stringify(mergedPayload) !== JSON.stringify(userRow.payload || {})) {
          updates.payload = mergedPayload;
        }
        if (normalizedEmail && normalizedEmail !== userRow.email) updates.email = normalizedEmail;
        if (usernameCandidate && !userRow.username) updates.username = usernameCandidate;
        if (googlePayload?.picture && googlePayload.picture !== userRow.avatar_url) updates.avatar_url = googlePayload.picture;
        if (Object.keys(updates).length) {
          const { error: updateError } = await supabase.from('fitbuddyai_userdata').update(updates).eq('user_id', userRow.user_id);
          if (updateError) {
            console.warn('[api/auth/google_id_token] failed to update profile', updateError);
          }
        }
      } else {
        const newUserId = uuidv4();
        const fallbackUsername = usernameCandidate || normalizedEmail.split('@')[0] || `fitbuddy-${newUserId.slice(0, 6)}`;
        const newRow = {
          user_id: newUserId,
          email: normalizedEmail,
          username: fallbackUsername,
          avatar_url: googlePayload?.picture || '',
          energy: 100,
          streak: 0,
          inventory: [],
          role: 'basic_member',
          accepted_terms: false,
          accepted_privacy: false,
          chat_history: [],
          workout_plan: null,
          questionnaire_progress: null,
          banned: false,
          payload: { google_account_id: googleAccountId }
        };
        const { data: inserted, error: insertError } = await supabase
          .from('fitbuddyai_userdata')
          .insert(newRow)
          .select('*')
          .maybeSingle();
        if (insertError) {
          console.error('[api/auth/google_id_token] failed to create profile', insertError);
          return res.status(500).json({ message: 'Failed to create user profile.' });
        }
        userRow = inserted || newRow;
      }
      if (!userRow) {
        return res.status(500).json({ message: 'Failed to resolve user profile.' });
      }
      const { data: finalRow } = await supabase.from('fitbuddyai_userdata').select('*').eq('user_id', userRow.user_id).maybeSingle();
      const resolved = finalRow || userRow;
      const token = signJwtForRow(resolved);
      const safeUser = buildSafeUser(resolved);
      return res.status(200).json({ user: safeUser, token });
    }

    return res.status(404).json({ message: 'Not found' });
  } catch (err: any) {
    console.error('[api/auth/index] error', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}
