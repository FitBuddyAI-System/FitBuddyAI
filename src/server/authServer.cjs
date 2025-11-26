// FitBuddy Auth Server (CommonJS)
const Filter = require('bad-words');
const filter = new Filter();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    console.log('[authServer.cjs] Supabase client initialized. Local file writes for user data are disabled.');
  } catch (e) {
    console.warn('[authServer.cjs] Failed to initialize Supabase client:', e);
    supabase = null;
  }
} else {
  console.warn('[authServer.cjs] Supabase not configured; runtime will avoid writing user data to local files.');
}
// __filename and __dirname are available in CommonJS by default

const bannedUsernamesFile = path.join(__dirname, 'bannedUsernames.json');
function isUsernameBanned(username) {
  try {
    const banned = JSON.parse(fs.readFileSync(bannedUsernamesFile, 'utf-8'));
    return banned.some(b => b.toLowerCase() === username.toLowerCase());
  } catch {
    return false;
  }
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Path to users.json file
const usersFile = path.join(__dirname, 'users.json');

// Get user by ID
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

// Update user profile (username, avatar)
app.post('/api/user/update', (req, res) => {
  try {
    const { id, username, avatar } = req.body;
    if (!id) return res.status(400).json({ message: 'User ID required.' });
    if (username && (filter.isProfane(username) || isUsernameBanned(username))) {
      return res.status(400).json({ message: 'Username contains inappropriate or banned words.' });
    }
    const users = readUsers();
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (username) user.username = username;
    if (avatar) user.avatar = avatar;
    writeUsers(users);
    // Do not send password back
    const { password, ...userSafe } = user;
    res.json({ user: userSafe });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Helper to read users from file
function readUsers() {
  // Prefer Supabase when available. Do not read local users.json by policy.
  if (supabase) {
    // Best-effort: fetch a small projection for admin/development uses.
    try {
      // Do not select legacy `payload` column (may not exist); fetch only a minimal projection
      supabase.from('fitbuddyai_userdata').select('user_id, email, username, chat_history, role, banned').limit(1000).then(({ data, error }) => {
        if (error) console.error('[authServer.cjs] readUsers supabase fetch error', error);
      });
    } catch (e) {
      console.error('[authServer.cjs] readUsers supabase fetch exception', e);
    }
    // Return empty array synchronously to avoid breaking callers; callers should use Supabase APIs directly for authoritative reads.
    return [];
  }
  console.error('[authServer.cjs] readUsers attempted but Supabase is not configured; local reads are disabled.');
  return [];
}

// Helper to write users to file
function writeUsers(users) {
  // Do NOT write to local users.json. If Supabase is configured, upsert rows; otherwise refuse.
  if (!supabase) {
    console.error('[authServer.cjs] writeUsers attempted but Supabase is not configured; refusing to write local users file.');
    throw new Error('Supabase not configured; cannot persist users.');
  }
    try {
    const rows = users.map(u => ({ user_id: u.id, email: u.email, username: u.username, avatar_url: u.avatar || '', chat_history: u.chat_history || [], role: u.role || null, banned: u.banned || false, updated_at: new Date().toISOString() }));
    supabase.from('fitbuddyai_userdata').upsert(rows, { onConflict: 'user_id' }).then(({ error }) => {
      if (error) console.error('[authServer.cjs] writeUsers: Supabase upsert error', error);
      else console.info('[authServer.cjs] writeUsers: upserted', rows.length, 'users to Supabase');
    }).catch(e => console.error('[authServer.cjs] writeUsers: upsert exception', e));
  } catch (e) {
    console.error('[authServer.cjs] writeUsers unexpected error', e);
    throw e;
  }
}

app.post('/api/auth/signup', (req, res) => {
  try {
    let { email, username, password } = req.body;
    if (!email || !username || !password) {
      res.status(400).json({ message: 'All fields are required.' });
      return;
    }
    email = String(email).trim().toLowerCase();
    if (filter.isProfane(username) || isUsernameBanned(username)) {
      res.status(400).json({ message: 'Username contains inappropriate or banned words.' });
      return;
    }
    const users = readUsers();
    if (users.find(u => String(u.email).toLowerCase() === email)) {
      res.status(409).json({ message: 'Email already exists.' });
      return;
    }
    const user = { id: uuidv4(), email, username, password };
    users.push(user);
    writeUsers(users);
    res.status(201).json({ user: { id: user.id, email: user.email, username: user.username } });
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
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }
    const { password: pw, ...userSafe } = user;
    res.json({ user: userSafe });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Auth server running on port ${PORT}`);
});
