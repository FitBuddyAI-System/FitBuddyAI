import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL as string | undefined;
const SUPABASE_KEY = process.env.SUPABASE_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[api/auth/index] Missing SUPABASE_URL or SUPABASE_KEY in environment; auth actions will fail');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

// Encryption helpers for refresh tokens (AES-256-GCM)
const ENC_ALGO = 'aes-256-gcm';
const ENC_KEY_RAW = process.env.REFRESH_TOKEN_ENC_KEY || process.env.REFRESH_TOKEN_KEY;
if (!ENC_KEY_RAW) {
  throw new Error('[api/auth] REFRESH_TOKEN_ENC_KEY is not set in the environment. Set REFRESH_TOKEN_ENC_KEY to a strong secret value to enable secure refresh token encryption.');
}
// Derive a 32-byte key from the provided secret using SHA-256
const ENC_KEY = crypto.createHash('sha256').update(String(ENC_KEY_RAW)).digest();

function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGO, ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as base64(iv|tag|ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptToken(blobB64: string): string {
  const buf = Buffer.from(blobB64, 'base64');
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const ciphertext = buf.slice(28);
  const decipher = crypto.createDecipheriv(ENC_ALGO, ENC_KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

const COOKIE_NAME = 'fitbuddyai_sid';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(';');
  for (const p of parts) {
    const [rawKey, ...rest] = p.split('=');
    if (!rawKey) continue;
    const key = rawKey.trim();
    if (!key) continue;

    const rawValue = (rest || []).join('=');
    if (rawValue === undefined) {
      // No value provided at all; treat as empty string
      out[key] = '';
      continue;
    }

    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
      // Empty or whitespace-only value; normalize to empty string
      out[key] = '';
      continue;
    }

    try {
      out[key] = decodeURIComponent(trimmedValue);
    } catch {
      // If decoding fails due to malformed percent-encoding, fall back to the raw trimmed value
      out[key] = trimmedValue;
    }
  }
  return out;
}

function makeSessionId() {
  return uuidv4();
}

const normalizeEmail = (value: string | undefined | null): string => {
  if (!value) return '';
  return String(value).trim().toLowerCase();
};

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
    
    // Store a refresh token server-side (persist in DB) and issue an HttpOnly session cookie.
    if (action === 'store_refresh') {
      const { userId, refresh_token } = req.body as { userId?: string; refresh_token?: string };
      if (!userId || !refresh_token) return res.status(400).json({ message: 'userId and refresh_token required.' });
      
      // Retry insert up to 3 times in case of rare session_id collision
      let sid: string | undefined;
      let insertErr: any = null;
      let attempt = 0;
      const enc = encryptToken(String(refresh_token));
      while (attempt < 3) {
        sid = makeSessionId();
        const { error } = await supabase.from('fitbuddyai_refresh_tokens').insert([{
          session_id: sid,
          user_id: userId,
          refresh_token: enc,
          created_at: new Date().toISOString(),
          last_used: new Date().toISOString(),
          revoked: false
        }]);
        if (!error) {
          insertErr = null;
          break;
        }
        // Check for unique violation (Supabase/Postgres error code '23505')
        if (error.code === '23505' || (error.message && error.message.includes('duplicate key value'))) {
          attempt++;
          continue; // Try again with a new session_id
        } else {
          insertErr = error;
          break;
        }
      }
      if (insertErr) {
        console.error('[api/auth/store_refresh] db insert failed', insertErr);
        return res.status(500).json({ message: 'Failed to persist refresh token' });
      }
      if (!sid) {
        return res.status(500).json({ message: 'Could not generate unique session_id' });
      }
      // Set cookie (HttpOnly). In production, set Secure and SameSite appropriately.
      const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      res.setHeader('Set-Cookie', `${COOKIE_NAME}=${sid}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}${secureFlag}`);
      return res.json({ ok: true, session_id: sid });
    }

    // Refresh access token using stored server-side refresh token (lookup by cookie)
    if (action === 'refresh') {
      try {
        const cookies = parseCookies(req.headers?.cookie as string | undefined);
        const sid = cookies[COOKIE_NAME];
        if (!sid) return res.status(401).json({ message: 'No session cookie present' });
        // Lookup DB row
        const { data: rows, error: selErr } = await supabase.from('fitbuddyai_refresh_tokens').select('*').eq('session_id', sid).limit(1).maybeSingle();
        if (selErr) {
          console.error('[api/auth/refresh] db select error', selErr);
          return res.status(500).json({ message: 'Failed to lookup session' });
        }
        const entry: any = rows as any;
        if (!entry || entry.revoked) return res.status(401).json({ message: 'Session not found or revoked' });
        // Optionally check expiry if expires_at present
        if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
          return res.status(401).json({ message: 'Session expired' });
        }
        // Decrypt the stored refresh token and call Supabase token endpoint to exchange it for a new access token
        let decryptedRefresh = '';
        try {
          decryptedRefresh = decryptToken(String(entry.refresh_token));
        } catch (e) {
          console.error('[api/auth/refresh] failed to decrypt refresh token', e);
          // Mark revoked to be safe
          try { await supabase.from('fitbuddyai_refresh_tokens').update({ revoked: true }).eq('session_id', sid); } catch {}
          return res.status(401).json({ message: 'Invalid session' });
        }
        const tokenUrl = `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`;
        const resp = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY || '',
            Authorization: `Bearer ${SUPABASE_KEY || ''}`
          },
          body: JSON.stringify({ refresh_token: decryptedRefresh })
        });
        const body = await resp.json();
        if (!resp.ok) {
          console.warn('[api/auth/refresh] supabase token refresh failed', body);
          // If refresh failed due to invalid token, mark revoked
          try { await supabase.from('fitbuddyai_refresh_tokens').update({ revoked: true }).eq('session_id', sid); } catch {}
          return res.status(401).json({ message: 'Failed to refresh token' });
        }
        // Update last_used and rotate refresh_token if provided
        try {
          const updates: { last_used: string; refresh_token?: string } = { last_used: new Date().toISOString() };
          if (body.refresh_token) updates.refresh_token = encryptToken(body.refresh_token);
          await supabase.from('fitbuddyai_refresh_tokens').update(updates).eq('session_id', sid);
        } catch (e) {
          console.warn('[api/auth/refresh] failed to update refresh token record', e);
        }
        // Do NOT return the refresh_token to the client. Return access_token and expiry only.
        return res.json({ access_token: body.access_token, expires_at: body.expires_at ?? body.expires_in });
      } catch (e) {
        console.error('[api/auth/refresh] error', e);
        return res.status(500).json({ message: 'Refresh failed' });
      }
    }

    // Clear stored refresh token and instruct browser to clear cookie
    if (action === 'clear_refresh') {
      try {
        const cookies = parseCookies(req.headers?.cookie as string | undefined);
        const sid = cookies[COOKIE_NAME];
        if (sid) {
          await supabase.from('fitbuddyai_refresh_tokens').update({ revoked: true }).eq('session_id', sid);
        }
        // Clear cookie
        res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
        return res.json({ ok: true });
      } catch {
        return res.status(500).json({ message: 'Failed to clear refresh session' });
      }
    }

    // Admin endpoints for revocation and cleanup. Require ADMIN_API_KEY via header 'x-admin-key'.
    // Admin endpoints replaced with JWT-based admin auth. Verify incoming
    // Authorization: Bearer <token> where <token> is a JWT signed by your
    // server's JWT secret and includes claim `role: 'service'` or `role: 'admin'.`
    async function requireAdmin() {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        // Fail fast if JWT_SECRET is not set
        console.error('[api/auth/index] Missing JWT_SECRET in environment; admin actions are disabled');
        return null;
    interface AdminJwtPayload {
      role: string;
      [key: string]: unknown;
    }
    async function requireAdmin() {
      const authHeader = String(req.headers['authorization'] || req.headers['Authorization'] || '');
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (!match) return null;
      const token = match[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me') as string | AdminJwtPayload;
        if (
          typeof decoded === 'object' &&
          decoded !== null &&
          'role' in decoded &&
          (decoded as AdminJwtPayload).role &&
          ((decoded as AdminJwtPayload).role === 'service' || (decoded as AdminJwtPayload).role === 'admin')
        ) {
          return decoded as AdminJwtPayload;
        }
        return null;
      } catch {
        return null;
      }
    }

    if (action === 'revoke_session') {
      const admin = await requireAdmin();
      if (!admin) return res.status(403).json({ message: 'Forbidden' });
      const { session_id } = req.body as { session_id?: string };
      if (!session_id) return res.status(400).json({ message: 'session_id required' });
      const { error: revErr } = await supabase.from('fitbuddyai_refresh_tokens').update({ revoked: true }).eq('session_id', session_id);
      if (revErr) return res.status(500).json({ message: 'Failed to revoke session' });
      return res.json({ ok: true });
    }

    if (action === 'revoke_user_sessions') {
      const admin = await requireAdmin();
      if (!admin) return res.status(403).json({ message: 'Forbidden' });
      const { userId } = req.body as { userId?: string };
      if (!userId) return res.status(400).json({ message: 'userId required' });
      const { error: revErr } = await supabase.from('fitbuddyai_refresh_tokens').update({ revoked: true }).eq('user_id', userId);
      if (revErr) return res.status(500).json({ message: 'Failed to revoke sessions for user' });
      return res.json({ ok: true });
    }

    if (action === 'cleanup_refresh_tokens') {
      const admin = await requireAdmin();
      if (!admin) return res.status(403).json({ message: 'Forbidden' });
      // Delete or mark as revoked entries older than N days (default 30)
      const days = Number(req.body?.days || 30);
      try {
        const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const { error: delErr } = await supabase.from('fitbuddyai_refresh_tokens').delete().lt('created_at', threshold);
        if (delErr) return res.status(500).json({ message: 'Cleanup failed' });
        return res.json({ ok: true });
      } catch {
        console.error('[api/auth/index] Error during cleanup_refresh_tokens', e);
        return res.status(500).json({ message: 'Cleanup failed' });
      }
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

    return res.status(404).json({ message: 'Not found' });
  } catch (err: any) {
    console.error('[api/auth/index] error', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}
