// server/userDataStore.js
// Express router for saving and loading user questionnaire progress and workout plan
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
// Local filesystem persistence is disabled; do not create local user_data directory.

// Prefer server/service key for server-side operations in dev
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
    console.log('[userDataStore] Supabase client initialized for local dev user data storage.');
  } catch (e) {
    console.warn('[userDataStore] Failed to initialize Supabase client:', e);
    supabase = null;
  }
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[userDataStore] SUPABASE not configured for local dev. User-data endpoints will return errors; local filesystem writes are disabled by policy.');
  console.warn('[userDataStore] To enable Supabase-backed storage locally, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) in your environment.');
}

// Local filesystem persistence disabled: no file helper provided.

// Save user data (questionnaire progress and workout plan)

router.post('/api/userdata/save', async (req, res) => {
  const { userId } = req.body || {};
  const { questionnaire_progress, workout_plan, fitbuddyai_questionnaire_progress, fitbuddyai_workout_plan, accepted_terms, accepted_privacy, chat_history } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  // No compatibility helpers: select and upsert explicit columns only.
  if (!supabase) {
    console.error('[userDataStore] Supabase not configured; refusing to read or write user data for userId:', userId);
    return res.status(500).json({ error: 'Supabase not configured; user data storage disabled in local server.' });
  }

  // Consider this a fetch only when the request contains no other keys besides userId.
  const bodyKeys = Object.keys(req.body || {}).filter(k => k !== 'userId' && k !== 'user_id');
  const isFetch = bodyKeys.length === 0;

  // Map known TOS acceptance helper key into explicit accepted_terms/accepted_privacy when present
  let tosAcceptedFlag = false;
  let privacyAcceptedFlag = false;
  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'fitbuddyai_tos_accepted_v1')) {
    try {
      const tosObj = req.body.fitbuddyai_tos_accepted_v1 || {};
      const entry = tosObj[Object.keys(tosObj)[0]] || {};
      if (entry && entry.tos) tosAcceptedFlag = true;
      if (entry && entry.privacy) privacyAcceptedFlag = true;
    } catch (err) {
      console.warn('[userDataStore] Failed to parse fitbuddyai_tos_accepted_v1; proceeding with default flags.', err);
    }
  }

  if (isFetch) {
      try {
        // Query explicit columns only; fail fast if schema is missing them.
        const { data, error } = await supabase.from('fitbuddyai_userdata').select('questionnaire_progress, workout_plan, chat_history, accepted_terms, accepted_privacy, streak, energy').eq('user_id', userId).limit(1).maybeSingle();
      if (error) {
        console.error('[userDataStore] Supabase fetch error for userId', userId, error);
        // If column missing, return a clear, fail-fast error message requested by user
        return res.status(500).json({ error: error.message || 'Supabase fetch failed' });
      }
      if (data) {
        // Return canonical keys only (no legacy compatibility fields)
        return res.json({ stored: { questionnaire_progress: data.questionnaire_progress ?? null, workout_plan: data.workout_plan ?? null, accepted_terms: data.accepted_terms ?? null, accepted_privacy: data.accepted_privacy ?? null, chat_history: data.chat_history ?? null, streak: data.streak ?? null, energy: data.energy ?? null } });
      }
      return res.json({ stored: { questionnaire_progress: null, workout_plan: null } });
    } catch (e) {
      console.error('[userDataStore] Supabase fetch exception for userId', userId, e);
      // Avoid leaking old column names; return the exception message
      return res.status(500).json({ error: e?.message || 'Supabase fetch exception' });
    }
  }

  // Save/update: map legacy request keys to canonical column values, but write explicit columns only.
  try {
    const upsertRow = { user_id: userId };
    if (accepted_terms !== undefined) upsertRow.accepted_terms = accepted_terms;
    else if (tosAcceptedFlag) upsertRow.accepted_terms = true;
    if (accepted_privacy !== undefined) upsertRow.accepted_privacy = accepted_privacy;
    else if (privacyAcceptedFlag) upsertRow.accepted_privacy = true;
    if (chat_history !== undefined) upsertRow.chat_history = typeof chat_history === 'string' ? (() => { try { return JSON.parse(chat_history); } catch { return chat_history; } })() : chat_history;

    // Use canonical column fields where possible. Only include columns if they were provided in the request.
    if (questionnaire_progress !== undefined) upsertRow.questionnaire_progress = questionnaire_progress;
    if (workout_plan !== undefined) upsertRow.workout_plan = workout_plan;
    if (fitbuddyai_questionnaire_progress !== undefined) upsertRow.questionnaire_progress = fitbuddyai_questionnaire_progress;
    if (fitbuddyai_workout_plan !== undefined) upsertRow.workout_plan = fitbuddyai_workout_plan;
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'streak')) upsertRow.streak = req.body.streak;
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'energy')) upsertRow.energy = req.body.energy;

    // Log the exact payload we're attempting to upsert so we can debug missing columns
    console.log('[userDataStore] upsert payload for userId', userId, upsertRow);

    // Ask Supabase to return the inserted/updated row so we can confirm persisted values (including `streak`)
    const { data: upsertedRows, error: upsertError } = await supabase.from('fitbuddyai_userdata').upsert(upsertRow, { onConflict: 'user_id', returning: 'representation' });
    if (upsertError) {
      console.error('[userDataStore] Supabase upsert error for userId', userId, upsertError);
      return res.status(500).json({ error: upsertError.message || 'Supabase upsert failed' });
    }

    const storedRow = Array.isArray(upsertedRows) && upsertedRows.length ? upsertedRows[0] : upsertRow;

    // Return canonical stored object with values returned from Supabase when available
    return res.json({ success: true, stored: { questionnaire_progress: storedRow.questionnaire_progress ?? upsertRow.questionnaire_progress ?? null, workout_plan: storedRow.workout_plan ?? upsertRow.workout_plan ?? null, accepted_terms: storedRow.accepted_terms ?? upsertRow.accepted_terms ?? null, accepted_privacy: storedRow.accepted_privacy ?? upsertRow.accepted_privacy ?? null, chat_history: storedRow.chat_history ?? upsertRow.chat_history ?? null, streak: storedRow.streak ?? upsertRow.streak ?? null } });
  } catch (e) {
    console.error('[userDataStore] supabase upsert exception', e);
    return res.status(500).json({ error: e?.message || 'Supabase upsert exception' });
  }
});

// Compatibility route for dev: accept POST /api/userdata/load to fetch stored payloads
router.post('/api/userdata/load', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  if (!supabase) {
    console.error('[userDataStore] Supabase not configured; refusing to load user data for userId:', userId);
    return res.status(500).json({ error: 'Supabase not configured; user data storage disabled in local server.' });
  }
    try {
      // Select explicit canonical columns (include `streak` and `energy` so clients can see them on load).
      const { data, error } = await supabase.from('fitbuddyai_userdata').select('questionnaire_progress, workout_plan, chat_history, accepted_terms, accepted_privacy, streak, energy').eq('user_id', userId).limit(1).maybeSingle();
    if (error) {
      console.error('[userDataStore] Supabase fetch error for userId', userId, error);
      return res.status(500).json({ error: error.message || 'Supabase fetch failed' });
    }
      if (data) {
        // Build stored result from explicit columns
        const wp = data.workout_plan ?? null;
        const qp = data.questionnaire_progress ?? null;
        const ch = data.chat_history ?? null;
        const stored = {
          fitbuddyai_workout_plan: wp,
          fitbuddyai_questionnaire_progress: qp,
          accepted_terms: data.accepted_terms ?? null,
          accepted_privacy: data.accepted_privacy ?? null,
          chat_history: ch,
          streak: data.streak ?? null,
          energy: data.energy ?? null
        };
        return res.json({ stored });
      }
      return res.json({ stored: { fitbuddyai_questionnaire_progress: null, fitbuddyai_workout_plan: null } });
  } catch (e) {
    console.error('[userDataStore] Supabase fetch exception for userId', userId, e);
    return res.status(500).json({ error: e?.message || 'Supabase fetch exception' });
  }
});

// Load user data
// Deprecated: use POST /api/userdata/save with { userId } to fetch stored payload
router.get('/api/userdata/:userId', (req, res) => {
  const { userId } = req.params;
  console.warn('[userDataStore] Deprecated GET /api/userdata/:userId called for', userId, '- use POST /api/userdata/save instead');
  res.status(410).json({ error: 'This endpoint is deprecated. Please POST to /api/userdata/save with { userId } to retrieve stored data.' });
});

export default router;
