import 'dotenv/config';

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import leoProfanity from 'leo-profanity';
leoProfanity.loadDictionary();

import express from 'express';
import userDataStoreRouter from './userDataStore.js';
import cors from 'cors';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import adminRoutes from './adminRoutes.js';

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(userDataStoreRouter);
app.use(adminRoutes);

// Inline admin endpoints to ensure /api/admin/users is available even if external files fail.
// This helper returns boolean (true when request is allowed) and is kept separate
// from `verifyAdminFromRequest` which returns the token-owner when verifying JWT.
function isAdminRequest(req) {
  const adminToken = process.env.ADMIN_API_TOKEN;
  if (!adminToken) return true; // no token configured -> allow (dev only)
  const auth = String(req.headers.authorization || req.headers.Authorization || '');
  return auth === `Bearer ${adminToken}`;
}

app.get('/api/admin/users', async (req, res) => {
  try {
  if (!isAdminRequest(req)) return res.status(403).json({ message: 'Forbidden' });

    if (supabase) {
      const { data, error } = await supabase.from('app_users').select('*').order('created_at', { ascending: false });
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

app.post('/api/admin/users', async (req, res) => {
  try {
  if (!isAdminRequest(req)) return res.status(403).json({ message: 'Forbidden' });
    const action = req.query.action || req.body?.action;
    const body = req.body || {};

    if (action === 'ban') {
      const { userId } = body;
      if (supabase) {
        const { error } = await supabase.from('app_users').update({ banned: true }).eq('id', userId);
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
        const { error } = await supabase.from('app_users').update({ banned: false }).eq('id', userId);
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
  try {
    const data = fs.readFileSync(usersFile, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

app.get('/api/user/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'User ID required.' });
    const users = readUsers();
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const { password, ...userSafe } = user;
    res.json({ user: userSafe });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/user/buy', (req, res) => {
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

app.post('/api/user/update', (req, res) => {
  try {
    const { id, username, avatar, streak } = req.body;
    if (!id) return res.status(400).json({ message: 'User ID required.' });
    if (username && (leoProfanity.check(username) || isUsernameBanned(username))) {
      return res.status(400).json({ message: 'Username contains inappropriate or banned words.' });
    }
    const users = readUsers();
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (username) user.username = username;
    if (avatar) user.avatar = avatar;
    if (typeof streak === 'number') user.streak = streak;
    writeUsers(users);
    const { password, ...userSafe } = user;
    res.json({ user: userSafe });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/user/apply-action', (req, res) => {
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
    const { prompt, userId, meta } = req.body || {};
    if (!prompt) return res.status(400).json({ message: 'Missing prompt' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
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
      generatedText = JSON.stringify(mockPlan);
    } else {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
    if (users.find(u => String(u.email).toLowerCase() === email)) return res.status(409).json({ message: 'Email already exists.' });
    const user = { id: uuidv4(), email, username, password, avatar: '', energy: 100, streak: 0, inventory: [] };
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const jwtToken = jwt.sign({ id: user.id, roles: user.roles || [] }, secret, { expiresIn: '30d' });
    user.token = uuidv4();
    users.push(user);
    writeUsers(users);
    // Also create a user_data file for local dev so chat history and payloads can be stored
    try {
      const userDataDir = path.join(__dirname, 'user_data');
      if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
      const dataPath = path.join(userDataDir, `${user.id}.json`);
      const initial = { id: user.id, payload: {}, chat_history: [], accepted_privacy: false, accepted_terms: false, updated_at: new Date().toISOString() };
      fs.writeFileSync(dataPath, JSON.stringify(initial, null, 2));
    } catch (udErr) {
      console.warn('[authServer] failed to write local user_data file', udErr);
    }
    // Try to upsert into Supabase if configured (best-effort)
    (async () => {
      try {
        if (supabase) {
          await supabase.from('app_users').upsert({ id: user.id, email: user.email, username: user.username, avatar: '', energy: 100, streak: 0, inventory: [] }, { onConflict: 'id' });
          await supabase.from('user_data').upsert({ id: user.id, payload: {}, chat_history: [], accepted_privacy: false, accepted_terms: false, updated_at: new Date().toISOString() }, { onConflict: 'id' });
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

app.get('/admin/audit', (req, res) => {
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

app.get('/api/users', (req, res) => {
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

app.use((req, res) => {
  res.status(404).json({ message: 'Not found.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => { console.log(`Auth server running on port ${PORT}`); });
