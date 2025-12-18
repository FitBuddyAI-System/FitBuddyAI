import 'dotenv/config';

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import leoProfanity from 'leo-profanity';
leoProfanity.loadDictionary();

import express from 'express';
import userDataStoreRouter from './userDataStore.js';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import cors from 'cors';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import adminRoutes from './adminRoutes.js';

// Initialize Supabase client early so module-level handlers can reference
// `supabase`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` safely.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    console.log('[authServer] Supabase client initialized for token verification.');
  } catch (e) {
    console.warn('[authServer] Failed to initialize Supabase client:', e);
    supabase = null;
  }
}

// Rate limiter for health endpoint - allow more requests since it's lightweight
const healthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many health check requests, please try again later.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

// Rate limiter for admin users endpoint - max 10 requests per minute for admin operations
const adminUsersLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each user to 50 admin requests per windowMs
  message: { error: 'Too many admin requests, please try again later.' },
  // Use user identity instead of IP for rate limiting
  keyGenerator: (req) => {
    // Try JWT-based auth first
    try {
      const auth = String(req.headers.authorization || '');
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (token) {
        const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
        const decoded = jwt.verify(token, secret);
        if (decoded?.id) return `user_${decoded.id}`;
      }
    } catch (err) {
      // JWT verification failed, try admin token
    }
    
    // Fall back to admin token or IP
    const adminToken = process.env.ADMIN_API_TOKEN;
    if (adminToken) {
      const auth = String(req.headers.authorization || req.headers.Authorization || '');
      if (auth === `Bearer ${adminToken}`) return `admin_token`;
    }
    
    // Final fallback to IP
    return ipKeyGenerator(req);
  }
});

// Rate limiter for auth endpoints (dev wrapper). This limiter is cookie/user-aware
// so that requests from the same dev session id (`fitbuddyai_sid`) are throttled
// separately from other clients. Falls back to IP-based keying.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each key (sid or IP) to 30 requests per windowMs
  message: { error: 'Too many auth requests, please try again later.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    try {
      // Prefer session cookie value when present to rate-limit per user session
      const cookieHeader = String(req.headers.cookie || '');
      const parts = cookieHeader.split(';').map(p => p.trim());
      for (const p of parts) {
        if (!p) continue;
        const [k, ...rest] = p.split('=');
        if (k && k.trim() === 'fitbuddyai_sid') return `sid_${(rest || []).join('=').trim()}`;
      }
      // If the client provided a userId in the body (store_refresh), use that
      if (req.body && req.body.userId) return `user_${String(req.body.userId)}`;
    } catch {
      // ignore and fall back to IP
    }
    return ipKeyGenerator(req);
  }
});

// Rate limiter for suggestions endpoint - protects /api/suggestions for user-generated workout suggestions with database operations
/**
 * Rate limiter for workout suggestion submissions.
 * 
 * This limiter is applied to endpoints that handle AI-powered workout generation including:
 * - User-submitted workout suggestions and preferences
 * - AI processing and workout plan generation
 * - Database operations via Supabase (required - no file system fallbacks)
 * 
 * The limit of 20 requests per 15 minutes (approximately 1.33 requests per minute) is chosen
 * to balance user creativity and AI resource usage. Workout suggestions involve significant
 * computational overhead and should be rate-limited to prevent abuse while allowing
 * reasonable user interaction for plan customization.
 * 
 * If you change the endpoints protected by this limiter, or if the resource usage profile changes,
 * please revisit these limits and update this comment accordingly.
 */
const suggestionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 suggestions per windowMs
  message: { error: 'Too many suggestions submitted, please try again later.' }
});

// Rate limiter for user actions - protects /api/user/apply-action endpoint that handles authenticated user operations like applying actions, updates, and other user-initiated changes
/**
 * Rate limiter for general user actions.
 * 
 * This limiter is applied to endpoints that perform user operations which may involve
 * moderate to high server resource usage including:
 * - Complex data processing and validation (workout plan updates, history tracking)
 * - Profanity/username validation and security checks
 * - Database operations via Supabase (required - no file system fallbacks)
 * - Audit logging operations
 * 
 * The limit of 30 requests per 15 minutes (2 requests per minute) is chosen to balance
 * normal user activity with protection against abuse or automated attacks, while allowing
 * sufficient capacity for legitimate user interactions like workout plan modifications,
 * profile updates, and inventory management.
 * 
 * NOTE: This limiter was added together with the suggestions endpoint rate limiter (see PR for code scanning alert #7),
 * even though it was not mentioned in the PR description. Rate limiting user actions is a reasonable defense-in-depth
 * measure to prevent abuse of resource-intensive operations, but this change extends beyond the original stated scope.
 * This comment documents the rationale for future maintainers and reviewers.
 * 
 * If you change the endpoints protected by this limiter, or if the resource usage profile changes,
 * please revisit these limits and update this comment accordingly.
 */
const userActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 user actions per windowMs
  message: { error: 'Too many user actions, please try again later.' }
});

// Rate limiter for user updates - protects /api/user/update endpoint for profile changes like username, avatar, and streak updates
/**
 * Rate limiter for user profile updates.
 * 
 * This limiter is applied to endpoints that update user profile information including:
 * - Username changes (with profanity and banned word validation)
 * - Avatar updates
 * - Streak counter modifications
 * - Database operations via Supabase
 * - Auth metadata synchronization
 * 
 * The limit of 10 requests per 15 minutes (approximately 0.67 requests per minute) is chosen
 * to prevent abuse while allowing reasonable profile customization activity. Profile updates
 * are typically infrequent operations that don't require high throughput.
 * 
 * NOTE: This limiter was added together with the suggestions endpoint rate limiter (see PR for code scanning alert #7),
 * even though it was not mentioned in the PR description. Rate limiting profile updates is a reasonable defense-in-depth
 * measure to prevent abuse (e.g., spamming profile changes), but this change extends beyond the original stated scope.
 * This comment documents the rationale for future maintainers and reviewers.
 * 
 * If you change the endpoints protected by this limiter, or if the resource usage profile changes,
 * please revisit these limits and update this comment accordingly.
 */
const userUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 user updates per windowMs
  message: { error: 'Too many user updates, please try again later.' }
});

// Rate limiter for user purchases - protects /api/user/buy endpoint for shop item purchases and energy transactions
/**
 * Rate limiter for user purchases and shop transactions.
 * 
 * This limiter is applied to endpoints that handle monetary transactions including:
 * - Shop item purchases using energy currency
 * - Energy deduction and inventory management
 * - Database operations via Supabase (required - no file system fallbacks)
 * - Transaction validation and balance checks
 * 
 * The limit of 5 requests per 15 minutes (approximately 0.33 requests per minute) is chosen
 * to be very restrictive, as purchases involve real economic value and should be carefully
 * rate-limited to prevent abuse, gaming, or accidental overspending. This allows for
 * occasional purchases while providing strong protection against automated attacks.
 * 
 * NOTE: This limiter was added together with the suggestions endpoint rate limiter (see PR for code scanning alert #7),
 * even though it was not mentioned in the PR description. Rate limiting purchases is a reasonable defense-in-depth
 * measure to prevent abuse of economic transactions, but this change extends beyond the original stated scope.
 * This comment documents the rationale for future maintainers and reviewers.
 * 
 * If you change the endpoints protected by this limiter, or if the resource usage profile changes,
 * please revisit these limits and update this comment accordingly.
 */
const userBuyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each user (or IP) to 5 purchases per windowMs
  message: { error: 'Too many purchase attempts, please try again later.' },
  keyGenerator: (req) => {
    // Try JWT-based user ID first
    try {
      const auth = String(req.headers.authorization || '');
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (token) {
        const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
        const decoded = jwt.verify(token, secret);
        if (decoded?.id) return `user_${decoded.id}`;
      }
    } catch (err) {
      // JWT verification failed, fall back to IP
    }
    // Fallback to IP address
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
});

const app = express();
app.use(cors());
app.use(bodyParser.json());
// Simple request logger to help debug routing issues in dev
app.use((req, res, next) => {
  try {
    console.log(`[authServer] ${req.method} ${req.originalUrl || req.url}`);
  } catch (err) {
    console.error('[authServer] Failed to log request', err);
  }
  next();
});
app.use(userDataStoreRouter);
app.use(adminRoutes);

// (moved earlier) dev-only in-memory refresh store is declared above near route setup

// Dev-only: support the serverless-style `/api/auth?action=...` endpoints used by the frontend
// The production serverless implementation lives in `api/auth/index.ts`. This wrapper allows
// the dev Express server to respond to the same calls when running `npm run dev`.
app.post('/api/auth', authLimiter, async (req, res) => {
  // Only enable this wrapper in development to avoid duplicating production behavior.
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ message: 'Not found' });
  try {
    const action = String(req.query?.action || '').toLowerCase();
    if (!action) return res.status(400).json({ message: 'action required' });

    // Helper to parse cookies
    function parseCookies(cookieHeader) {
      const out = {};
      if (!cookieHeader) return out;
      const parts = cookieHeader.split(';');
      for (const p of parts) {
        const [k, ...rest] = p.split('=');
        if (!k) continue;
        const key = k.trim();
        const rawValue = (rest || []).join('=').trim();
        try {
          out[key] = decodeURIComponent(rawValue);
        } catch {
          // Fall back to raw value if decoding fails to avoid dropping the cookie
          out[key] = rawValue;
        }
      }
      return out;
    }

    // Store encrypted refresh token in dev in-memory store. This mirrors the
    // production behavior (encrypted at rest) and requires the
    // `REFRESH_TOKEN_ENC_KEY` environment variable to be set. If the key is
    // missing the request will fail so that dev environments must opt-in to
    // secure token handling (avoid plaintext storage).
    if (action === 'store_refresh') {
      if (!ENC_KEY) return res.status(500).json({ message: 'Server missing REFRESH_TOKEN_ENC_KEY; cannot store refresh token.' });
      const { userId, refresh_token } = req.body || {};
      if (!userId || !refresh_token) return res.status(400).json({ message: 'userId and refresh_token required.' });
      const sid = uuidv4();
      try {
        const enc = encryptToken(String(refresh_token));
        _devRefreshStore.set(sid, { userId, refreshToken: enc, createdAt: Date.now(), lastUsed: Date.now(), revoked: false });
      } catch (e) {
        console.error('[authServer] failed to encrypt refresh token', e);
        return res.status(500).json({ message: 'Failed to persist refresh token' });
      }
      const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
      const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      res.setHeader('Set-Cookie', `fitbuddyai_sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SECONDS}${secureFlag}`);
      return res.json({ ok: true, session_id: sid });
    }

    if (action === 'refresh') {
      const cookies = parseCookies(req.headers?.cookie || '');
      const sid = cookies['fitbuddyai_sid'];
      if (!sid) return res.status(401).json({ message: 'No session cookie present' });
      const entry = _devRefreshStore.get(sid);
      if (!entry || entry.revoked) return res.status(401).json({ message: 'Session not found or revoked' });
      // Call Supabase token endpoint using stored (encrypted) refresh token
      // (requires SUPABASE_SERVICE_ROLE_KEY). Decrypt before use.
      try {
        if (!ENC_KEY) return res.status(500).json({ message: 'Server missing REFRESH_TOKEN_ENC_KEY; cannot use stored refresh token.' });
        let decrypted = '';
        try {
          decrypted = decryptToken(entry.refreshToken);
        } catch (e) {
          console.error('[authServer] failed to decrypt stored refresh token', e);
          _devRefreshStore.delete(sid);
          return res.status(401).json({ message: 'Invalid session' });
        }
        // Use environment lookups here to avoid potential module-initialization
        // ordering issues where the module-level constants might not yet be set.
        const tokenUrl = `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`;
        const resp = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`
          },
          body: JSON.stringify({ refresh_token: decrypted })
        });
        const body = await resp.json();
        if (!resp.ok) {
          console.warn('[authServer dev wrapper] supabase token refresh failed', body);
          // If refresh failed, revoke the dev session
          _devRefreshStore.delete(sid);
          return res.status(401).json({ message: 'Failed to refresh token' });
        }
        // rotate refresh token if provided
        if (body.refresh_token) {
          try {
            entry.refreshToken = encryptToken(body.refresh_token);
          } catch (e) {
            console.warn('[authServer] failed to encrypt rotated refresh token', e);
            // Best-effort: remove session to avoid leaving an unpersisted rotated token
            // in memory when we cannot securely store it; require dev to re-login.
            _devRefreshStore.delete(sid);
            return res.status(500).json({ message: 'Failed to persist rotated refresh token' });
          }
          entry.lastUsed = Date.now();
          _devRefreshStore.set(sid, entry);
        }
        return res.json({ access_token: body.access_token, expires_at: body.expires_at ?? body.expires_in });
      } catch (e) {
        console.error('[authServer dev wrapper] refresh error', e);
        return res.status(500).json({ message: 'Refresh failed' });
      }
    }

    if (action === 'clear_refresh') {
      try {
        const cookies = parseCookies(req.headers?.cookie || '');
        const sid = cookies['fitbuddyai_sid'];
        if (sid) _devRefreshStore.delete(sid);
        res.setHeader('Set-Cookie', `fitbuddyai_sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
        return res.json({ ok: true });
      } catch (e) {
        console.error('[authServer dev wrapper] clear_refresh error', e);
        return res.status(500).json({ message: 'Failed to clear refresh session' });
      }
    }

    return res.status(404).json({ message: 'Not found' });
  } catch (e) {
    console.error('[authServer dev wrapper] error', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to validate target URLs to avoid SSRF.
// Only server-configured webhook targets are allowed. Client-supplied
// targets are intentionally not supported to avoid open proxy/SSRF risks.

// Server-side proxy to forward questionnaire payloads to Google Apps Script webhook
app.post('/api/webhook/questionnaire', async (req, res) => {
  try {
    // Prefer server-side config for the target webhook to avoid open proxy.
    const configured = process.env.SHEET_WEBHOOK_URL;
    const body = req.body || {};
    const payload = body?.payload || body;

    const target = configured;
    // Do NOT accept client-provided targets. Require server configuration.
    if (!target) {
      console.warn('[authServer] /api/webhook/questionnaire: no target configured on server');
      return res.status(400).json({ message: 'No webhook target configured on server.' });
    }

    // Forward the request to the target webhook
    try {
      const response = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      if (!response.ok) {
        console.warn('[authServer] webhook forward failed', response.status, text);
        return res.status(502).json({ message: 'Failed to forward webhook', status: response.status, body: text });
      }
      return res.json({ ok: true, forwarded: true, response: text });
    } catch (err) {
      console.error('[authServer] webhook forward error', err);
      return res.status(502).json({ message: 'Failed to forward webhook', error: String(err) });
    }
  } catch (err) {
    console.error('[authServer] /api/webhook/questionnaire error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Inline admin endpoints to ensure /api/admin/users is available even if external files fail.
// This helper returns boolean (true when request is allowed) and is kept separate
// from `verifyAdminFromRequest` which returns the token-owner when verifying JWT.
function isAdminRequest(req) {
  const adminToken = process.env.ADMIN_API_TOKEN;
  if (!adminToken) return true; // no token configured -> allow (dev only)
  const auth = String(req.headers.authorization || req.headers.Authorization || '');
  return auth === `Bearer ${adminToken}`;
}

app.get('/api/admin/users', adminUsersLimiter, async (req, res) => {
  try {
    console.log('[authServer] /api/ai/generate request headers:', {
      ct: req.headers['content-type'] || req.headers['Content-Type'] || null,
      length: req.headers['content-length'] || null
    });
    try { console.log('[authServer] /api/ai/generate raw body type:', typeof req.body); } catch(e) {}
  if (!isAdminRequest(req)) return res.status(403).json({ message: 'Forbidden' });

    if (supabase) {
      const { data, error } = await supabase.from('fitbuddyai_userdata').select('*').order('created_at', { ascending: false });
      if (error) return res.status(500).json({ message: 'Failed to fetch users from Supabase', detail: error.message });
      return res.json({ users: data || [] });
    }

    // Fallback to local users file
    const users = readUsers();
    const safe = users.map(u => { const { password, ...rest } = u; return rest; });
    return res.json({ users: safe });
  } catch (err) {
    console.error('[authServer] /api/admin/users error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/users', adminUsersLimiter, async (req, res) => {
  try {
  if (!isAdminRequest(req)) return res.status(403).json({ message: 'Forbidden' });
    const action = req.query.action || req.body?.action;
    const body = req.body || {};

    if (action === 'ban') {
      const { userId } = body;
        if (supabase) {
        const { error } = await supabase.from('fitbuddyai_userdata').update({ banned: true }).eq('user_id', userId);
        if (error) throw error;
        return res.json({ ok: true });
      }
      const users = readUsers();
      const u = users.find(x => x.id === userId);
      if (!u) return res.status(404).json({ message: 'User not found' });
      u.banned = true; writeUsers(users);
      return res.json({ ok: true });
    }

    if (action === 'unban') {
      const { userId } = body;
        if (supabase) {
        const { error } = await supabase.from('fitbuddyai_userdata').update({ banned: false }).eq('user_id', userId);
        if (error) throw error;
        return res.json({ ok: true });
      }
      const users = readUsers();
      const u = users.find(x => x.id === userId);
      if (!u) return res.status(404).json({ message: 'User not found' });
      u.banned = false; writeUsers(users);
      return res.json({ ok: true });
    }

    if (action === 'restore_plan') {
      const { planId } = body;
      if (supabase) {
        const { error } = await supabase.from('workout_plans').update({ deleted: false }).eq('id', planId);
        if (error) throw error;
        return res.json({ ok: true });
      }
      return res.status(400).json({ message: 'Not supported in local mode' });
    }

    if (action === 'ban_username') {
      const { username } = body;
      if (supabase) {
        const { error } = await supabase.from('banned_usernames').insert({ username });
        if (error) throw error;
        return res.json({ ok: true });
      }
      return res.status(400).json({ message: 'Not supported in local mode' });
    }

    return res.status(400).json({ message: 'Bad request' });
  } catch (err) {
    console.error('[authServer] /api/admin/users POST error', err);
    res.status(500).json({ message: 'Server error', detail: err?.message || String(err) });
  }
});

const usersFile = path.join(__dirname, 'users.json');

// Dev-only in-memory refresh store to support client calls to /api/auth?action=...
// This is intentionally ephemeral and only used when running the local auth server.
// Mark as intentionally used to satisfy linters/static analyzers even when
// some analysis paths don't detect the usage inside route handlers.
// eslint-disable-next-line no-unused-vars
const _devRefreshStore = new Map();

// Encryption helpers for refresh tokens (AES-256-GCM) — mirror production
const ENC_ALGO = 'aes-256-gcm';
// Normalize the env var and trim whitespace to avoid using empty/whitespace-only keys.
const ENC_KEY_RAW = (process.env.REFRESH_TOKEN_ENC_KEY || process.env.REFRESH_TOKEN_KEY || '').toString().trim();
let ENC_KEY = null;
if (ENC_KEY_RAW && ENC_KEY_RAW.length > 0) {
  try {
    ENC_KEY = crypto.createHash('sha256').update(ENC_KEY_RAW).digest();
  } catch (e) {
    console.warn('[authServer] failed to derive ENC_KEY from REFRESH_TOKEN_ENC_KEY', e);
    ENC_KEY = null;
  }
}

function encryptToken(plain) {
  if (!ENC_KEY) throw new Error('REFRESH_TOKEN_ENC_KEY not configured');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGO, ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptToken(blobB64) {
  if (!ENC_KEY) throw new Error('REFRESH_TOKEN_ENC_KEY not configured');
  const buf = Buffer.from(String(blobB64), 'base64');
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const ciphertext = buf.slice(28);
  const decipher = crypto.createDecipheriv(ENC_ALGO, ENC_KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

const authLogFile = path.join(__dirname, 'auth_server.log');
function logAuth(entry) {
  try {
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n';
    fs.appendFileSync(authLogFile, line);
  } catch (e) {
    console.warn('authServer logging failed:', e);
  }
}

function makeLoginUrl(req) {
  try {
    const returnTo = encodeURIComponent(req.originalUrl || req.url || '/chat');
    return `/signin?returnTo=${returnTo}`;
  } catch {
    return '/signin';
  }
}

function isUsernameBanned(username) {
  try {
    const bannedUsernamesFile = path.join(__dirname, 'bannedUsernames.json');
    const banned = JSON.parse(fs.readFileSync(bannedUsernamesFile, 'utf-8'));
    return banned.some(b => b.toLowerCase() === username.toLowerCase());
  } catch {
    return false;
  }
}

function readUsers() {
  // Prefer Supabase when configured (production). For local development
  // fall back to the local users.json so dev workflows still work.
  try {
    if (supabase) console.info('[authServer] readUsers: Supabase configured — falling back to local users.json for dev/testing.');
    // Read local users.json (works for both dev and for quick local testing)
    try {
      const raw = fs.readFileSync(usersFile, 'utf-8');
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[authServer] readUsers: failed to read local users file, returning empty array', e);
      return [];
    }
  } catch (e) {
    console.error('[authServer] readUsers unexpected error', e);
    throw e;
  }
}

function writeUsers(users) {
  // Require Supabase for writes in production — do not persist to local files.
  if (!supabase) {
    console.error('[authServer] writeUsers attempted but Supabase is not configured; refusing to persist users.');
    throw new Error('Supabase not configured; cannot persist users.');
  }
  try {
    const rows = users.map(u => ({ user_id: u.id, email: u.email, username: u.username, avatar_url: u.avatar || '', chat_history: u.chat_history || [], role: u.role || null, banned: u.banned || false, updated_at: new Date().toISOString() }));
    supabase.from('fitbuddyai_userdata').upsert(rows, { onConflict: 'user_id' }).then(({ error }) => {
      if (error) console.error('[authServer] writeUsers: Supabase upsert error', error);
      else console.info('[authServer] writeUsers: upserted', rows.length, 'users to Supabase');
    }).catch(e => {
      console.error('[authServer] writeUsers: upsert exception', e);
    });
  } catch (e) {
    console.error('[authServer] writeUsers: unexpected error', e);
    throw e;
  }
}

app.get('/api/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'User ID required.' });
    if (supabase) {
      try {
        const { data, error } = await supabase.from('fitbuddyai_userdata').select('*').eq('user_id', id).limit(1).maybeSingle();
        if (error) {
          console.error('[authServer] /api/user/:id supabase error', error);
          return res.status(500).json({ message: 'Supabase error.' });
        }
        if (!data) return res.status(404).json({ message: 'User not found.' });
        const { password, ...userSafe } = data || {};
        return res.status(200).json({ user: userSafe });
      } catch (e) {
        console.error('[authServer] /api/user/:id error', e);
        return res.status(500).json({ message: 'Server error.' });
      }
    }
    return res.status(500).json({ message: 'Supabase not configured.' });
  } catch (err) {
    console.error('[authServer] /api/user/:id unexpected', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/user/buy', userBuyLimiter, (req, res) => {
  try {
    const { id, item } = req.body;
    if (!id || !item) return res.status(400).json({ message: 'User ID and item required.' });
    const users = readUsers();
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (typeof user.energy !== 'number' || user.energy < item.price) {
      return res.status(400).json({ message: 'Not enough energy.' });
    }
    user.energy -= item.price;
    if (!Array.isArray(user.inventory)) user.inventory = [];
    user.inventory.push(item);
    writeUsers(users);
    const { password, ...userSafe } = user;
    res.json({ user: userSafe });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/user/update', userUpdateLimiter, async (req, res) => {
  try {
    const { id, username, avatar, streak } = req.body || {};
    if (!id) return res.status(400).json({ message: 'User ID required.' });
    if (username && (leoProfanity.check(username) || isUsernameBanned(username))) {
      return res.status(400).json({ message: 'Username contains inappropriate or banned words.' });
    }
    if (!supabase) return res.status(500).json({ message: 'Supabase not configured.' });

    // Build updates
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (avatar !== undefined) updates.avatar_url = avatar;
    if (typeof streak === 'number') updates.streak = streak;
    if (Object.keys(updates).length === 0) return res.status(400).json({ message: 'No update fields provided.' });

    try {
      const { data, error } = await supabase.from('fitbuddyai_userdata').update(updates).eq('user_id', id).select().limit(1).maybeSingle();
      if (error) {
        console.error('[authServer] update error', error);
        return res.status(500).json({ message: 'Failed to update user.' });
      }
      if (!data) return res.status(404).json({ message: 'User not found.' });

      const { password, ...safe } = data || {};

      // Attempt to update Supabase auth metadata (admin API when available)
      try {
        if (supabase && typeof (supabase.auth?.admin?.updateUserById) === 'function') {
          await (supabase.auth).admin.updateUserById(id, { user_metadata: { display_name: safe.username, username: safe.username } });
        } else if (supabase && typeof (supabase.auth?.updateUser) === 'function') {
          try {
            await (supabase.auth).updateUser({ data: { display_name: safe.username, username: safe.username } });
          } catch (metadataErr) {
            console.warn(
              '[authServer] non-admin supabase auth metadata update failed',
              metadataErr && metadataErr.message ? metadataErr.message : String(metadataErr)
            );
          }
        } else {
          console.warn('[authServer] supabase auth admin update not available');
        }
      } catch (e) {
        console.warn('[authServer] failed to update supabase auth metadata', e && e.message ? e.message : String(e));
      }

      return res.status(200).json({ user: safe });
    } catch (e) {
      console.error('[authServer] update user exception', e);
      return res.status(500).json({ message: 'Server error.' });
    }
  } catch (err) {
    console.error('[authServer] /api/user/update unexpected', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Accept user-submitted workout suggestions. Stored in Supabase when configured,
// otherwise appended to a local `suggestions.json` file in the dev server folder.
app.post('/api/suggestions', suggestionsLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const exercises = Array.isArray(body.exercises) ? body.exercises : (typeof body.exercises === 'string' ? String(body.exercises).split('\n').map(s=>s.trim()).filter(Boolean) : []);
    const userId = body.userId || null;
    if (!title) return res.status(400).json({ message: 'Title required.' });

    const entry = {
      id: uuidv4(),
      user_id: userId,
      title,
      description,
      exercises,
      created_at: new Date().toISOString()
    };

    if (supabase) {
      try {
        const insert = { user_id: entry.user_id, title: entry.title, description: entry.description, exercises: entry.exercises, created_at: entry.created_at };
        const { data, error } = await supabase.from('workout_suggestions').insert(insert).select().maybeSingle();
        if (error) {
          console.error('[authServer] suggestions insert error', error);
          return res.status(500).json({ message: 'Failed to save suggestion.' });
        }
        return res.json({ ok: true, suggestion: data || insert });
      } catch (e) {
        console.warn('[authServer] suggestions supabase error', e);
        return res.status(500).json({ message: 'Failed to save suggestion.' });
      }
    }

    // Fallback: persist to local file for dev convenience
    try {
      const suggestionsFile = path.join(__dirname, 'suggestions.json');
      let arr = [];
      try { arr = JSON.parse(fs.readFileSync(suggestionsFile, 'utf8') || '[]'); } catch (e) { arr = []; }
      arr.push(entry);
      fs.writeFileSync(suggestionsFile, JSON.stringify(arr, null, 2), 'utf8');
      return res.json({ ok: true, suggestion: entry });
    } catch (e) {
      console.error('[authServer] failed to persist suggestion locally', e);
      return res.status(500).json({ message: 'Failed to save suggestion.' });
    }
  } catch (err) {
    console.error('[authServer] /api/suggestions error', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/user/apply-action', userActionLimiter, (req, res) => {
  try {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const { id, action } = req.body || {};
    if (!token) return res.status(401).json({ message: 'Missing Authorization token.', loginUrl: makeLoginUrl(req) });
    if (!id || !action || !action.__action) return res.status(400).json({ message: 'Invalid action payload.' });

    // Supabase verification (preferred)
    if (supabase) {
      (async () => {
        try {
          const { data, error } = await supabase.auth.getUser(token);
          if (error || !data || !data.user) {
            logAuth({ event: 'apply-action', outcome: 'invalid_token', tokenPreview: String(token).slice(0,12), ip: req.ip });
            return res.status(401).json({ message: 'Invalid or expired token.', loginUrl: makeLoginUrl(req) });
          }
          const decodedId = data.user.id;
          if (decodedId !== id) {
            logAuth({ event: 'apply-action', outcome: 'mismatched_id', decodedId, requestedId: id, ip: req.ip });
            return res.status(403).json({ message: 'Token does not match user.' });
          }
          const users = readUsers();
          const localUser = users.find(u => u.id === decodedId) || null;
          if (!localUser) {
            logAuth({ event: 'apply-action', outcome: 'user_not_found_local', decodedId, ip: req.ip });
            return res.status(404).json({ message: 'User not found.' });
          }
          processActionForUser(localUser, action, users, res);
          return;
        } catch (err) {
          console.warn('Supabase token verification failed:', err);
          return res.status(401).json({ message: 'Invalid or expired token.', loginUrl: makeLoginUrl(req) });
        }
      })();
      return;
    }

    // Fallback to local JWT verification
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    let decoded = null;
    try {
      decoded = jwt.verify(token, secret);
    } catch (jwtErr) {
      const isProd = (process.env.NODE_ENV === 'production');
      if (isProd) {
        logAuth({ event: 'apply-action', outcome: 'invalid_jwt', tokenPreview: String(token).slice(0,12), ip: req.ip });
        return res.status(401).json({ message: 'Invalid or expired token.', loginUrl: makeLoginUrl(req) });
      }
      const users = readUsers();
      const tokenOwner = users.find(u => u.token === token);
      if (!tokenOwner) return res.status(403).json({ message: 'Invalid token.' });
      if (tokenOwner.id !== id) return res.status(403).json({ message: 'Token does not match user.' });
      const user = users.find(u => u.id === id);
      if (!user) return res.status(404).json({ message: 'User not found.' });
      processActionForUser(user, action, users, res);
      return;
    }

    const users = readUsers();
    const tokenOwner = users.find(u => u.id === decoded?.id);
    if (!tokenOwner) {
      logAuth({ event: 'apply-action', outcome: 'token_owner_missing', decodedId: decoded?.id, ip: req.ip });
      return res.status(403).json({ message: 'Invalid token.' });
    }
    if (tokenOwner.id !== id) {
      logAuth({ event: 'apply-action', outcome: 'mismatched_id', decodedId: decoded?.id, requestedId: id, ip: req.ip });
      return res.status(403).json({ message: 'Token does not match user.' });
    }
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    processActionForUser(user, action, users, res);
  } catch (err) {
    console.error('apply-action error', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Development helper: apply an action without authentication. ONLY enabled
// when not in production. This is useful for local testing when Supabase
// authentication is configured and you want a quick dev-only path.
app.post('/api/dev/apply-action', (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ message: 'Not allowed in production.' });
    const { id, action } = req.body || {};
    if (!id || !action) return res.status(400).json({ message: 'Missing id or action.' });
    const users = readUsers();
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    // Reuse the same processActionForUser code path so behavior matches production
    processActionForUser(user, action, users, res);
    return;
  } catch (err) {
    console.error('dev apply-action error', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Track rickroll events: client posts when a user is redirected to the rickroll.
app.post('/api/rickroll', async (req, res) => {
  try {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    let providedUserId = req.body?.userId || null;
    let verified = false;
    let decodedId = null;

    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';

    // Prefer Supabase verification when available
    if (supabase && token) {
      try {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data && data.user) {
          decodedId = data.user.id;
          verified = true;
        }
      } catch (e) {
        // ignore verification failure
      }
    } else if (token) {
      try {
        const decoded = jwt.verify(token, secret);
        decodedId = decoded?.id || null;
        verified = !!decodedId;
      } catch (e) {
        // invalid token
      }
    }

    const userIdToLog = decodedId || providedUserId || null;
    const auditLine = {
      timestamp: new Date().toISOString(),
      event: 'rickroll',
      userId: userIdToLog,
      verified: !!verified,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null
    };
    const auditFile = path.join(__dirname, 'ai_action_audit.log');
    fs.appendFileSync(auditFile, JSON.stringify(auditLine) + '\n');
    return res.json({ ok: true });
  } catch (err) {
    console.error('rickroll logging error', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Local AI generation endpoint for dev server
app.post('/api/ai/generate', async (req, res) => {
  try {
    // Be forgiving about incoming body shapes (prompt, contents, inputs, messages)
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { /* leave as string */ }
    }

    const joinPartsText = (parts) => {
      try {
        if (!Array.isArray(parts)) return '';
        return parts.map(p => {
          if (!p) return '';
          if (typeof p === 'string') return p;
          return p.text || p.content || '';
        }).filter(Boolean).join('\n');
      } catch (e) { return ''; }
    };

    let prompt = undefined;
    if (typeof body.prompt === 'string' && body.prompt.trim()) prompt = body.prompt.trim();
    // contents -> parts -> text
    if (!prompt && Array.isArray(body.contents)) {
      for (const c of body.contents) {
        if (!c) continue;
        if (typeof c === 'string' && c.trim()) { prompt = c.trim(); break; }
        const j = joinPartsText(c.parts ?? c);
        if (j) { prompt = j; break; }
      }
    }
    // inputs
    if (!prompt && Array.isArray(body.inputs) && body.inputs.length) {
      const inp = body.inputs[0];
      if (typeof inp === 'string') prompt = inp;
      else if (typeof inp.content === 'string') prompt = inp.content;
      else {
        const j = joinPartsText(inp.parts ?? inp);
        if (j) prompt = j;
      }
    }
    // messages
    if (!prompt && Array.isArray(body.messages) && body.messages.length) {
      const last = body.messages[body.messages.length - 1];
      if (typeof last === 'string') prompt = last;
      else if (typeof last.content === 'string') prompt = last.content;
      else if (last && typeof last.content === 'object') prompt = last.content.text || joinPartsText(last.content.parts ?? last);
    }

    const userId = body.userId || body.user_id || null;
    const meta = body.meta || null;
    if (!prompt) {
      // return minimal diagnostic so callers can see what's arriving
      let sample = '';
      try { sample = (typeof req.body === 'string') ? req.body.slice(0,2000) : JSON.stringify(req.body, null, 2).slice(0,2000); } catch(e) { sample = String(req.body).slice(0,2000); }
      return res.status(400).json({ message: 'Missing prompt', bodyType: typeof req.body, bodySample: sample });
    }

    // Accept multiple env var names so deployments that used VITE_/NEXT_PUBLIC_ still work
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const GEMINI_URL = GEMINI_API_KEY
      ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`
      : null;

    let generatedText = '';
    if (!GEMINI_URL) {
      const allowMock = process.env.LOCAL_AI_MOCK === '1' || process.env.NODE_ENV !== 'production';
      if (!allowMock) return res.status(500).json({ message: 'AI provider not configured', diagnostic: { env_GEMINI_API_KEY_present: false } });
      console.warn('[authServer] GEMINI_API_KEY missing — returning local mock response (development)');
      const today = new Date().toISOString().split('T')[0];
      const mockPlan = {
        id: `mock-${Date.now()}`,
        name: 'Local Mock Plan',
        description: 'This is a local mock workout plan used when GEMINI API key is not configured.',
        startDate: today,
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        totalDays: 7,
        totalTime: '30 minutes',
        weeklyStructure: ['Monday','Wednesday','Friday'],
        dailyWorkouts: [
          {
            date: today,
            type: 'strength',
            completed: false,
            totalTime: '30 minutes',
            workouts: [
              { name: 'Bodyweight Squats', difficulty: 'beginner', duration: '10 minutes', reps: 12, muscleGroups: ['legs'], equipment: [], description: 'Simple squats.' }
            ],
            alternativeWorkouts: []
          }
        ]
      };
      // For local dev, return a human-facing message indicating the
      // feature is under development rather than a fabricated JSON plan.
      generatedText = 'Sorry, this feature is currently under development.';
    } else {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    // If the AI returned an empty string unexpectedly, return a small
    // deterministic fallback so clients (chat/planner) have valid JSON
    // to parse and we fail more loudly in dev rather than returning silently
    // empty text which is confusing in the UI.
    try {
      if (!generatedText || String(generatedText).trim().length === 0) {
        console.warn('[authServer] generatedText empty — returning deterministic fallback plan');
        const today2 = new Date().toISOString().split('T')[0];
        const fallbackPlan = {
          id: `fallback-${Date.now()}`,
          name: 'Fallback Plan (empty AI response)',
          description: 'Returned because the AI returned an empty result. Configure GEMINI_API_KEY or inspect server logs.',
          startDate: today2,
          endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          totalDays: 1,
          totalTime: '0 minutes',
          weeklyStructure: [],
          dailyWorkouts: [
            { date: today2, type: 'rest', completed: false, totalTime: '0 minutes', workouts: [], alternativeWorkouts: [] }
          ]
        };
                generatedText = 'Sorry, this feature is currently under development.';
      }
    } catch (e) {
      console.warn('[authServer] fallback generation failed', e);
    }

    // Audit-log if supabase is configured
    try {
      if (supabase) {
        await supabase.from('audit_logs').insert({
          user_id: userId || null,
          event: 'ai_response',
          action: { prompt, response: generatedText, meta },
          ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
          user_agent: req.headers['user-agent'] || null,
          verified: false
        });
      }
    } catch (e) {
      console.warn('[authServer] Failed to insert audit log', e);
    }

    return res.json({ text: generatedText });
  } catch (err) {
    console.error('[authServer] /api/ai/generate error', err);
    return res.status(500).json({ message: 'AI generation failed' });
  }
});

function processActionForUser(user, action, users, res) {
  try {
    const updates = Array.isArray(action.updates) ? action.updates : [];
    const allowedFields = new Set(['energy', 'streak', 'username', 'avatar']);
    let planDiffSummary = null;

    // Helper: set a nested value on an object using path segments, creating objects/arrays as needed
    function setByPath(root, segments, value) {
      let cur = root;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        // Prevent prototype-polluting segments
        if (seg === '__proto__' || seg === 'constructor' || seg === 'prototype') {
          console.warn(
            '[SECURITY] Prototype pollution attempt blocked in setByPath: segment', seg, 'in path', segments, 'with value:', value
          );
          return false;
        }
        const isLast = i === segments.length - 1;
        const idx = String(seg).match(/^\d+$/) ? Number(seg) : null;

        if (isLast) {
          if (idx !== null) {
            // final numeric index: cur must be an array
            if (!Array.isArray(cur)) return false;
            // If index is past the end, append instead of creating holes
            if (idx > cur.length) {
              cur.push(value);
            } else {
              // fill intermediate indices with empty objects to avoid sparse holes
              while (cur.length <= idx) cur.push({});
              cur[idx] = value;
            }
            return true;
          } else {
            cur[seg] = value;
            return true;
          }
        }

        // not last; decide whether to create an object or array for the next segment
        const nextSeg = segments[i + 1];
        const nextIsIndex = String(nextSeg).match(/^\d+$/) ? true : false;

        if (idx !== null) {
          // current segment is numeric -> cur must be an array
          if (!Array.isArray(cur)) return false;
          if (cur[idx] === undefined) {
            cur[idx] = nextIsIndex ? [] : {};
          }
          cur = cur[idx];
        } else {
          // current segment is string
          if (nextIsIndex) {
            if (!Array.isArray(cur[seg])) cur[seg] = [];
          } else {
            if (typeof cur[seg] !== 'object' || cur[seg] === null) cur[seg] = {};
          }
          cur = cur[seg];
        }
      }
      return false;
    }

    // Helper: push into array by path
    function pushByPath(root, segments, value) {
      let cur = root;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        // Prevent prototype-polluting segments
        if (seg === '__proto__' || seg === 'constructor' || seg === 'prototype') {
          console.warn(
            '[SECURITY] Prototype pollution attempt detected in pushByPath: segment "%s" in path [%s]',
            seg,
            segments.join(', ')
          );
          return false;
        }
        const isLast = i === segments.length - 1;
        const idx = String(seg).match(/^\d+$/) ? Number(seg) : null;

        if (isLast) {
          if (idx !== null) {
            if (!Array.isArray(cur)) return false;
            // ensure array exists at index and fill holes
            while (cur.length <= idx) cur.push([]);
            if (!Array.isArray(cur[idx])) cur[idx] = [];
            if (Array.isArray(value)) cur[idx] = cur[idx].concat(value);
            else cur[idx].push(value);
            return true;
          } else {
            if (!Array.isArray(cur[seg])) cur[seg] = [];
            if (Array.isArray(value)) cur[seg] = cur[seg].concat(value);
            else cur[seg].push(value);
            return true;
          }
        }

        const nextSeg = segments[i + 1];
        const nextIsIndex = String(nextSeg).match(/^\d+$/) ? true : false;

        if (idx !== null) {
          if (!Array.isArray(cur)) return false;
          if (cur[idx] === undefined) cur[idx] = nextIsIndex ? [] : {};
          cur = cur[idx];
        } else {
          if (nextIsIndex) {
            if (!Array.isArray(cur[seg])) cur[seg] = [];
          } else {
            if (typeof cur[seg] !== 'object' || cur[seg] === null) cur[seg] = {};
          }
          cur = cur[seg];
        }
      }
      return false;
    }

    function validateWorkoutItem(item) {
      if (typeof item !== 'object' || !item) return false;
      if (!item.name || !item.duration) return false;
      if (item.muscleGroups && !Array.isArray(item.muscleGroups)) return false;
      return true;
    }

    for (const u of updates) {
      try {
        if (u.op === 'set' && typeof u.path === 'string') {
          // support slash-delimited paths
          // allow either slash-delimited or dot-delimited paths (AI may use either)
          const cleanedPath = String(u.path || '').replace(/\./g, '/');
          const parts = cleanedPath.split('/').filter(Boolean);
          // special-case username validation
          if (parts.length === 1 && parts[0] === 'username') {
            const v = String(u.value || '');
            if (leoProfanity.check(v) || isUsernameBanned(v)) {
              return res.status(400).json({ message: 'Username contains inappropriate or banned words.' });
            }
            user.username = v;
            continue;
          }

          // top-level allowed fields
          if (parts.length === 1 && allowedFields.has(parts[0])) {
            user[parts[0]] = u.value;
            continue;
          }

          // route updates into nested workoutPlan safely
          if (parts[0] === 'workoutPlan') {
            // ensure history tracking only when replacing whole plan
            if (parts.length === 1 && typeof u.value === 'object') {
              if (!Array.isArray(user.workoutPlanHistory)) user.workoutPlanHistory = [];
              const previous = user.workoutPlan;
              if (previous) user.workoutPlanHistory.push({ timestamp: new Date().toISOString(), plan: previous });
              // compute diff summary (best-effort)
              try {
                const prevByDate = (previous?.dailyWorkouts || []).reduce((acc, d) => (acc[d.date] = d, acc), {});
                const newByDate = (u.value?.dailyWorkouts || []).reduce((acc, d) => (acc[d.date] = d, acc), {});
                const added = [];
                const removed = [];
                const changed = [];
                for (const date of Object.keys(newByDate)) {
                  if (!prevByDate[date]) added.push(date);
                  else if (JSON.stringify(prevByDate[date]) !== JSON.stringify(newByDate[date])) changed.push(date);
                }
                for (const date of Object.keys(prevByDate)) if (!newByDate[date]) removed.push(date);
                const partsSummary = [];
                if (added.length) partsSummary.push(`${added.length} day(s) added`);
                if (removed.length) partsSummary.push(`${removed.length} day(s) removed`);
                if (changed.length) partsSummary.push(`${changed.length} day(s) changed`);
                planDiffSummary = partsSummary.length ? partsSummary.join(', ') : 'No significant changes detected';
              } catch (diffErr) {
                planDiffSummary = null;
              }
              user.workoutPlan = u.value;
              continue;
            }

            // For nested paths, apply via helpers
            // e.g. 'workoutPlan/dailyWorkouts/2/workouts'
            const targetRoot = user.workoutPlan = user.workoutPlan || {};
            const relativeParts = parts.slice(1);

            // If setting workouts (array), validate items
            if (relativeParts[relativeParts.length - 1] === 'workouts' && Array.isArray(u.value)) {
              const ok = u.value.every(validateWorkoutItem);
              if (!ok) {
                console.warn('Invalid workout item skipped');
              }
            }

            // Try setByPath; if fails, attempt to create structure then set
            const success = setByPath(targetRoot, relativeParts, u.value);
            if (!success) {
              // as a fallback, attempt pushing into inventory-like structures
              console.warn('setByPath failed for', u.path);
            }
            continue;
          }

          // unknown path => skip
          console.warn('Unknown set path, skipping', u.path);
        } else if (u.op === 'push' && typeof u.path === 'string') {
          const cleanedPath = String(u.path || '').replace(/\./g, '/');
          const parts = cleanedPath.split('/').filter(Boolean);
          if (parts.length === 1 && parts[0] === 'inventory' && Array.isArray(u.value)) {
            if (!Array.isArray(user.inventory)) user.inventory = [];
            user.inventory = user.inventory.concat(u.value);
            continue;
          }
          if (parts[0] === 'workoutPlan') {
            const targetRoot = user.workoutPlan = user.workoutPlan || {};
            const relativeParts = parts.slice(1);
            const pushed = pushByPath(targetRoot, relativeParts, u.value);
            if (!pushed) console.warn('pushByPath failed for', u.path);
            continue;
          }
        }
      } catch (innerErr) {
        console.warn('Skipped invalid update', innerErr);
      }
    }

    try {
      const auditLine = { timestamp: new Date().toISOString(), userId: user.id, action };
      const auditFile = path.join(__dirname, 'ai_action_audit.log');
      fs.appendFileSync(auditFile, JSON.stringify(auditLine) + '\n');
    } catch (auditErr) {
      console.warn('Failed to write audit log', auditErr);
    }

    // sanitize workoutPlan arrays to remove nulls before writing
    try {
      for (const u of users) {
        if (u && u.workoutPlan && Array.isArray(u.workoutPlan.dailyWorkouts)) {
          u.workoutPlan.dailyWorkouts = u.workoutPlan.dailyWorkouts.filter(Boolean);
        }
      }
    } catch (sErr) { /* best-effort */ }

    writeUsers(users);
    const { password, ...userSafe } = user;
    const resp = { user: userSafe, applied: action.summary || 'Applied updates.' };
    if (planDiffSummary) resp.planDiffSummary = planDiffSummary;
    return res.json(resp);
  } catch (err) {
    console.error('processActionForUser error', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}

app.post('/api/auth/signup', (req, res) => {
  try {
    let { email, username, password } = req.body;
    if (!email || !username || !password) return res.status(400).json({ message: 'All fields are required.' });
    email = String(email).trim().toLowerCase();
    if (leoProfanity.check(username) || isUsernameBanned(username)) return res.status(400).json({ message: 'Username contains inappropriate or banned words.' });
    const users = readUsers();
  if (users.find(u => String(u.email).toLowerCase() === email)) return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Email already exists.' });
    const user = { id: uuidv4(), email, username, password, avatar: '', energy: 100, streak: 0, inventory: [] };
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const jwtToken = jwt.sign({ id: user.id, roles: user.roles || [] }, secret, { expiresIn: '30d' });
    user.token = uuidv4();
    users.push(user);
    writeUsers(users);
    // Local filesystem persistence for user_data is disabled by policy.
    console.info('[authServer] skipped creating local user_data file for new user (Supabase-only persistence enforced).');
    // Try to upsert into Supabase if configured (best-effort)
    (async () => {
      try {
          if (supabase) {
          await supabase.from('fitbuddyai_userdata').upsert({ user_id: user.id, email: user.email, username: user.username, avatar_url: '', energy: 100, streak: 0, inventory: [], chat_history: [], accepted_privacy: false, accepted_terms: false, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        }
      } catch (sErr) {
        console.warn('[authServer] supabase upsert during signup failed', sErr);
      }
    })();
    res.status(201).json({ user: { id: user.id, email: user.email, username: user.username, avatar: user.avatar, energy: user.energy, streak: user.streak, inventory: user.inventory, token: jwtToken } });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/auth/signin', (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });
    email = String(email).trim().toLowerCase();
    const users = readUsers();
    const user = users.find(u => String(u.email).toLowerCase() === email && u.password === password);
    if (!user) return res.status(401).json({ message: 'Invalid email or password.' });
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const jwtToken = jwt.sign({ id: user.id, roles: user.roles || [] }, secret, { expiresIn: '30d' });
    user.token = uuidv4();
    writeUsers(users);
    res.json({ user: { id: user.id, email: user.email, username: user.username, energy: user.energy, streak: user.streak, token: jwtToken } });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

function verifyAdminFromToken(req) {
  try {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return null;
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const decoded = jwt.verify(token, secret);
    const users = readUsers();
    const tokenOwner = users.find(u => u.id === decoded?.id);
    if (!tokenOwner) return null;
    const roles = Array.isArray(decoded?.roles) ? decoded.roles : (Array.isArray(tokenOwner.roles) ? tokenOwner.roles : []);
    if (!roles.includes('admin')) return null;
    return tokenOwner;
  } catch (err) {
    return null;
  }
}

app.get('/admin/audit', adminUsersLimiter, (req, res) => {
  try {
  const admin = verifyAdminFromToken(req);
    if (!admin) return res.status(403).json({ message: 'Forbidden' });
    const auditFile = path.join(__dirname, 'ai_action_audit.log');
    if (!fs.existsSync(auditFile)) return res.json({ logs: [] });
    const raw = fs.readFileSync(auditFile, 'utf-8').trim();
    if (!raw) return res.json({ logs: [] });
    const lines = raw.split('\n').map(l => { try { return JSON.parse(l); } catch { return { raw: l }; } });
    return res.json({ logs: lines });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to read audit log.' });
  }
});

app.get('/api/users', adminUsersLimiter, (req, res) => {
  try {
  const admin = verifyAdminFromToken(req);
    if (!admin) return res.status(403).json({ message: 'Forbidden' });
    const users = readUsers();
    const safe = users.map(u => { const { password, ...rest } = u; return rest; });
    return res.json({ users: safe });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Lightweight health endpoint for quick checks
app.get('/api/health', healthLimiter, (req, res) => {
  return res.json({ ok: true, time: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Not found.' });
});

const PORT = process.env.PORT || 3001;
// Bind to 0.0.0.0 so the dev server is reachable from other hosts (Live Share, containers, VMs)
app.listen(PORT, '0.0.0.0', () => { console.log(`Auth server running on port ${PORT}`); });
