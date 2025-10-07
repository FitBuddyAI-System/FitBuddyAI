import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
// filesystem fallback removed — use Supabase to verify admin role

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

function checkAdminToken(req: any) {
  const adminToken = process.env.ADMIN_API_TOKEN;
  // If no ADMIN_API_TOKEN is configured, do NOT auto-allow — require other verification methods
  if (!adminToken) return false;
  const auth = String(req.headers.authorization || req.headers.Authorization || '').replace(/^Bearer\s*/i, '');
  return auth === adminToken;
}

export default async function handler(req: any, res: any) {
  const action = String(req.query.action || req.query?.[0] || '').toLowerCase();
  const isVercel = Boolean(process.env.VERCEL);

  try {
    // sanitize helper: remove keys with null or undefined values from an object
    const sanitizePayload = (p: any) => {
      if (p === null || p === undefined) return null;
      if (typeof p !== 'object') return p;
      try {
        const out: any = {};
        for (const [k, v] of Object.entries(p)) {
          if (v === null || v === undefined) continue;
          out[k] = v;
        }
        return out;
      } catch (e) {
        return p;
      }
    };

    if (action === 'save' || req.url?.includes('/save')) {
      // POST save
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const body = req.body || {};
      const userId = body.userId;
      const payload = body.payload ?? {
        fitbuddy_questionnaire_progress: body.fitbuddy_questionnaire_progress ?? null,
        fitbuddy_workout_plan: body.fitbuddy_workout_plan ?? null,
        fitbuddy_assessment_data: body.fitbuddy_assessment_data ?? null,
        // Optional new fields: terms acceptance and chat history
        accepted_terms: body.accepted_terms ?? null,
        accepted_privacy: body.accepted_privacy ?? null,
        chat_history: body.chat_history ?? null
      };
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const safePayload = typeof payload === 'string' ? JSON.parse(payload) : payload || {};
      const sanitizedPayload = sanitizePayload(safePayload) || {};
      if (!supabase) {
        // Filesystem fallback for development: persist to server/user_data/<userId>.json
        try {
          const filePath = path.join(process.cwd(), 'server', 'user_data', `${userId}.json`);
          let existing: any = {};
          if (fs.existsSync(filePath)) {
            try { existing = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { existing = {}; }
          }
          const toWrite: any = { ...existing };
          if (sanitizedPayload.fitbuddy_workout_plan !== undefined) toWrite.fitbuddy_workout_plan = typeof sanitizedPayload.fitbuddy_workout_plan === 'string' ? sanitizedPayload.fitbuddy_workout_plan : JSON.stringify(sanitizedPayload.fitbuddy_workout_plan);
          if (sanitizedPayload.fitbuddy_questionnaire_progress !== undefined) toWrite.fitbuddy_questionnaire_progress = typeof sanitizedPayload.fitbuddy_questionnaire_progress === 'string' ? sanitizedPayload.fitbuddy_questionnaire_progress : JSON.stringify(sanitizedPayload.fitbuddy_questionnaire_progress);
          if (sanitizedPayload.fitbuddy_assessment_data !== undefined) toWrite.fitbuddy_assessment_data = typeof sanitizedPayload.fitbuddy_assessment_data === 'string' ? sanitizedPayload.fitbuddy_assessment_data : JSON.stringify(sanitizedPayload.fitbuddy_assessment_data);
          if (sanitizedPayload.accepted_terms !== undefined) toWrite.accepted_terms = sanitizedPayload.accepted_terms;
          if (sanitizedPayload.accepted_privacy !== undefined) toWrite.accepted_privacy = sanitizedPayload.accepted_privacy;
          if (sanitizedPayload.chat_history !== undefined) {
            try { toWrite.chat_history = typeof sanitizedPayload.chat_history === 'string' ? sanitizedPayload.chat_history : JSON.stringify(sanitizedPayload.chat_history); } catch { toWrite.chat_history = sanitizedPayload.chat_history; }
          }
          fs.writeFileSync(filePath, JSON.stringify(toWrite, null, 2), 'utf8');
          try { res.setHeader('x-userdata-source', 'filesystem'); } catch (e) {}
          return res.status(200).json({ ok: true, stored: sanitizedPayload, chat_history: sanitizedPayload.chat_history ?? null });
        } catch (e: any) {
          console.error('[api/userdata] filesystem fallback write failed:', e);
          return res.status(500).json({ error: e?.message || 'Filesystem write failed' });
        }
      }
      try {
          // Ensure chat_history is stored as an array if provided as JSON string
          if (sanitizedPayload && typeof sanitizedPayload.chat_history === 'string') {
            try { sanitizedPayload.chat_history = JSON.parse(sanitizedPayload.chat_history); } catch (e) { /* keep raw string if parse fails */ }
          }
        // Build a row that includes both payload and explicit columns (if present)
        // Ensure chat_history is stored only in the explicit `chat_history` column and not inside payload
        const payloadToWrite: any = { ...sanitizedPayload };
        const upsertRow: any = { user_id: userId };
        if (payloadToWrite && Object.prototype.hasOwnProperty.call(payloadToWrite, 'accepted_terms')) {
          upsertRow.accepted_terms = payloadToWrite.accepted_terms;
          delete payloadToWrite.accepted_terms;
        }
        if (payloadToWrite && Object.prototype.hasOwnProperty.call(payloadToWrite, 'accepted_privacy')) {
          upsertRow.accepted_privacy = payloadToWrite.accepted_privacy;
          delete payloadToWrite.accepted_privacy;
        }
        if (payloadToWrite && Object.prototype.hasOwnProperty.call(payloadToWrite, 'chat_history')) {
          upsertRow.chat_history = typeof payloadToWrite.chat_history === 'string'
            ? (() => { try { return JSON.parse(payloadToWrite.chat_history); } catch { return payloadToWrite.chat_history; } })()
            : payloadToWrite.chat_history;
          // remove from payload so only explicit column holds chat_history
          delete payloadToWrite.chat_history;
        }
        upsertRow.payload = payloadToWrite;
        const { error } = await supabase.from('user_data').upsert(upsertRow, { onConflict: 'user_id' });
        if (error) {
          console.error('[api/userdata] supabase upsert error:', error);
          return res.status(500).json({ error: error.message || 'Upsert failed' });
        }
          try { res.setHeader('x-userdata-source', 'supabase'); } catch (e) {}
        return res.status(200).json({ ok: true, stored: payloadToWrite, chat_history: upsertRow.chat_history ?? null });
      } catch (e: any) {
        console.error('[api/userdata] supabase upsert threw exception:', e);
        return res.status(500).json({ error: e?.message || 'Upsert exception' });
      }
    }

    if (action === 'admin') {
      const body = req.body || {};
      const diag: any = {
        hadAdminApiToken: false,
        hadAuthHeader: false,
        supabaseEnvPresent: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY),
        supabaseAdminPresent: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
        verifiedViaSupabaseToken: false,
        verifiedViaJWT: false,
        verifiedViaClientUser: false
      };

      let allowSelf = false;
      if (checkAdminToken(req)) {
        diag.hadAdminApiToken = true;
      } else {
        const authHeader = String(req.headers.authorization || req.headers.Authorization || '').replace(/^Bearer\s*/i, '') || null;
        if (authHeader) diag.hadAuthHeader = true;
        const tokenFromBody = (body && body.token) ? String(body.token) : null;
        const tokenToVerify = authHeader || tokenFromBody;
        let ok = false;
        if (tokenToVerify && process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
          try {
            const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
            const { data: ud, error: ue } = await client.auth.getUser(tokenToVerify);
            if (!ue && ud && ud.user) {
              const uid = ud.user.id;
              try {
                const { data: appRow } = await client.from('app_users').select('role').eq('id', uid).limit(1).maybeSingle();
                if (appRow && appRow.role === 'admin') ok = true;
              } catch {}
              try {
                const { data: pubRow } = await client.from('public.users').select('role').eq('id', uid).limit(1).maybeSingle();
                if (pubRow && pubRow.role === 'admin') ok = true;
              } catch {}
              if (ok) diag.verifiedViaSupabaseToken = true;
            }
          } catch (e) {}
        }
        if (!ok) {
          try {
            const jwtSecret = process.env.JWT_SECRET || 'dev_secret_change_me';
            if (tokenToVerify) {
              const payload: any = jwt.verify(tokenToVerify, jwtSecret);
              if (payload && payload.role === 'admin') ok = true;
              if (ok) diag.verifiedViaJWT = true;
            }
          } catch (e) {}
        }
        if (!ok) {
          try {
            const clientUser = body.fitbuddy_user_data && typeof body.fitbuddy_user_data === 'string'
              ? (JSON.parse(body.fitbuddy_user_data).data || JSON.parse(body.fitbuddy_user_data))
              : (body.fitbuddy_user_data?.data || body.fitbuddy_user_data || null);

            const checkWithClient = async (client: any, selector: { id?: string; email?: string }) => {
              const uid = selector.id ? String(selector.id) : null;
              const email = selector.email ? String(selector.email) : null;
              if (uid) {
                try {
                  const { data: appRow } = await client.from('app_users').select('role').eq('id', uid).limit(1).maybeSingle();
                  if (appRow && appRow.role === 'admin') return true;
                } catch {}
                try {
                  const { data: pubRow } = await client.from('public.users').select('role').eq('id', uid).limit(1).maybeSingle();
                  if (pubRow && pubRow.role === 'admin') return true;
                } catch {}
              }
              if (email) {
                try {
                  const { data: appRow } = await client.from('app_users').select('role').eq('email', email).limit(1).maybeSingle();
                  if (appRow && appRow.role === 'admin') return true;
                } catch {}
                try {
                  const { data: pubRow } = await client.from('public.users').select('role').eq('email', email).limit(1).maybeSingle();
                  if (pubRow && pubRow.role === 'admin') return true;
                } catch {}
              }
              return false;
            };

            if (clientUser && (clientUser.id || clientUser.email)) {
              if (supabaseAdmin) {
                try {
                  const okAdmin = await checkWithClient(supabaseAdmin, { id: clientUser.id, email: clientUser.email });
                  if (okAdmin) ok = true;
                } catch {}
              }
              if (!ok && supabase) {
                try {
                  const client = supabase;
                  const okAnon = await checkWithClient(client, { id: clientUser.id, email: clientUser.email });
                  if (okAnon) ok = true;
                } catch {}
              }
              if (ok) diag.verifiedViaClientUser = true;
            }
          } catch (e) {}
        }
        // If not an admin, allow the call only if the provided token belongs to the same userId being requested
        if (!ok) {
          try {
            if (tokenToVerify) {
              // Try Supabase to resolve token -> user id
              if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
                try {
                  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
                  const { data: ud } = await client.auth.getUser(tokenToVerify);
                  const tokenUid = ud?.user?.id || null;
                  if (tokenUid && body.userId && String(tokenUid) === String(body.userId)) {
                    allowSelf = true;
                  }
                } catch (e) {}
              }
              // Fallback to local JWT verification
              if (!allowSelf) {
                try {
                  const jwtSecret = process.env.JWT_SECRET || 'dev_secret_change_me';
                  if (tokenToVerify) {
                    const payloadAny: any = jwt.verify(tokenToVerify, jwtSecret);
                    const tokenUid = payloadAny?.sub || payloadAny?.id || null;
                    if (tokenUid && body.userId && String(tokenUid) === String(body.userId)) {
                      allowSelf = true;
                    }
                  }
                } catch (e) {}
              }
            }
          } catch (e) {}
        }
        if (!ok && !allowSelf) return res.status(403).json({ error: 'Forbidden', diag });
      }
    // allow using the regular supabase client when the service role key isn't provided
    const dbClient = supabaseAdmin || supabase || null;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const userId = body.userId;
      // Debug logs to help local development: show diag and masked auth header
      try {
        const rawAuth = String(req.headers.authorization || req.headers.Authorization || '') || '';
        const masked = rawAuth ? (rawAuth.slice(0, 8) + '...[masked]') : '(none)';
        console.log('[api/userdata] admin request diag:', { userId, maskedAuth: masked, ...diag });
      } catch (e) {}
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const hasFitbuddyFields = (body && (
        body.fitbuddy_workout_plan !== undefined ||
        body.fitbuddy_questionnaire_progress !== undefined ||
        body.fitbuddy_assessment_data !== undefined ||
        body.accepted_terms !== undefined ||
        body.accepted_privacy !== undefined ||
        body.chat_history !== undefined
      ));
      const payloadToStore = body.payload
        ? (typeof body.payload === 'string' ? JSON.parse(body.payload) : body.payload)
        : (hasFitbuddyFields
          ? {
              fitbuddy_questionnaire_progress: body.fitbuddy_questionnaire_progress ?? null,
              fitbuddy_workout_plan: body.fitbuddy_workout_plan ?? null,
              fitbuddy_assessment_data: body.fitbuddy_assessment_data ?? null
            }
          : null);

      if (payloadToStore !== null) {
        // If we have a DB client, upsert to Supabase. Otherwise fallback to local filesystem for development.
        if (dbClient) {
          const sanitized = sanitizePayload(payloadToStore) || {};
          // Strip chat_history out of payload so it is only stored in explicit column
          const payloadToWriteAdmin: any = { ...sanitized };
          const upsertRow: any = { user_id: userId };
          if (payloadToWriteAdmin && Object.prototype.hasOwnProperty.call(payloadToWriteAdmin, 'accepted_terms')) {
            upsertRow.accepted_terms = payloadToWriteAdmin.accepted_terms;
            delete payloadToWriteAdmin.accepted_terms;
          }
          if (payloadToWriteAdmin && Object.prototype.hasOwnProperty.call(payloadToWriteAdmin, 'accepted_privacy')) {
            upsertRow.accepted_privacy = payloadToWriteAdmin.accepted_privacy;
            delete payloadToWriteAdmin.accepted_privacy;
          }
          if (payloadToWriteAdmin && Object.prototype.hasOwnProperty.call(payloadToWriteAdmin, 'chat_history')) {
            try { upsertRow.chat_history = typeof payloadToWriteAdmin.chat_history === 'string' ? JSON.parse(payloadToWriteAdmin.chat_history) : payloadToWriteAdmin.chat_history; } catch (e) { upsertRow.chat_history = payloadToWriteAdmin.chat_history; }
            delete payloadToWriteAdmin.chat_history;
          }
          upsertRow.payload = payloadToWriteAdmin;
          const { error } = await dbClient.from('user_data').upsert(upsertRow, { onConflict: 'user_id' });
          if (error) return res.status(500).json({ error: error.message || 'Upsert failed' });
          res.setHeader('x-userdata-source', 'supabase');
          return res.status(200).json({ ok: true, stored: payloadToWriteAdmin, chat_history: upsertRow.chat_history ?? null });
        } else {
          // If running on Vercel we don't attempt a filesystem write fallback (serverless readonly fs),
          // instead return an informative error so deployment env can be fixed.
          if (isVercel) {
            return res.status(500).json({ error: 'No Supabase configured in environment and filesystem fallback disabled on Vercel', diag: { supabaseEnvPresent: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY) } });
          }
          try {
            const filePath = path.join(process.cwd(), 'server', 'user_data', `${userId}.json`);
            let existing: any = {};
            if (fs.existsSync(filePath)) {
              try { existing = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { existing = {}; }
            }
            // Ensure we persist fields in the same shape as other local files (stringified JSON)
            const toWrite: any = { ...existing };
            if (payloadToStore.fitbuddy_workout_plan !== undefined) toWrite.fitbuddy_workout_plan = typeof payloadToStore.fitbuddy_workout_plan === 'string' ? payloadToStore.fitbuddy_workout_plan : JSON.stringify(payloadToStore.fitbuddy_workout_plan);
            if (payloadToStore.fitbuddy_questionnaire_progress !== undefined) toWrite.fitbuddy_questionnaire_progress = typeof payloadToStore.fitbuddy_questionnaire_progress === 'string' ? payloadToStore.fitbuddy_questionnaire_progress : JSON.stringify(payloadToStore.fitbuddy_questionnaire_progress);
            if (payloadToStore.fitbuddy_assessment_data !== undefined) toWrite.fitbuddy_assessment_data = typeof payloadToStore.fitbuddy_assessment_data === 'string' ? payloadToStore.fitbuddy_assessment_data : JSON.stringify(payloadToStore.fitbuddy_assessment_data);
            // Persist chat_history explicitly when present (store as JSON string)
            if (payloadToStore.chat_history !== undefined) {
              try {
                toWrite.chat_history = typeof payloadToStore.chat_history === 'string' ? payloadToStore.chat_history : JSON.stringify(payloadToStore.chat_history);
              } catch (e) {
                toWrite.chat_history = payloadToStore.chat_history;
              }
            }
            // Write back to filesystem
            fs.writeFileSync(filePath, JSON.stringify(toWrite, null, 2), 'utf8');
            console.log('[api/userdata] admin wrote payload to filesystem fallback for', userId);
            res.setHeader('x-userdata-source', 'filesystem');
            return res.status(200).json({ ok: true, stored: payloadToStore, source: 'filesystem' });
          } catch (e: any) {
            console.error('[api/userdata] filesystem write error:', e);
            return res.status(500).json({ error: e?.message || 'Filesystem write failed' });
          }
        }
      }

      let resultPayload: any = null;
      if (dbClient) {
        try {
          // request explicit columns if available
          const { data, error } = await dbClient.from('user_data').select('payload, accepted_terms, accepted_privacy, chat_history').eq('user_id', userId).limit(1).maybeSingle();
          if (error) {
            console.error('[api/userdata] admin fetch error:', error);
          } else {
            try { console.log('[api/userdata] admin fetch result payload keys:', data && data.payload ? Object.keys(data.payload) : data); } catch (e) {}
            // If explicit columns exist, merge them into the returned payload shape
            const payloadFromDb = data?.payload ?? null;
            const cols = { accepted_terms: data?.accepted_terms ?? null, accepted_privacy: data?.accepted_privacy ?? null, chat_history: data?.chat_history ?? null };
            if (payloadFromDb && typeof payloadFromDb === 'object') {
              // prefer explicit columns when present
              const merged: any = { ...payloadFromDb };
              if (cols.accepted_terms !== null && cols.accepted_terms !== undefined) merged.accepted_terms = cols.accepted_terms;
              if (cols.accepted_privacy !== null && cols.accepted_privacy !== undefined) merged.accepted_privacy = cols.accepted_privacy;
              if (cols.chat_history !== null && cols.chat_history !== undefined) merged.chat_history = cols.chat_history;
              resultPayload = merged;
            } else if (cols.accepted_terms !== null || cols.accepted_privacy !== null || cols.chat_history !== null) {
              resultPayload = sanitizePayload(cols) || null;
            } else {
              resultPayload = payloadFromDb;
            }
          }
        } catch (e) {
          console.error('[api/userdata] admin fetch unexpected error:', e);
        }
      }

      // If no payload from Supabase (or no DB client), try local filesystem fallback for development
      if (!resultPayload) {
        if (isVercel) {
          // On Vercel we don't use the filesystem fallback; return empty result so client sees no payload
          console.log('[api/userdata] running on Vercel: skipping filesystem fallback for', userId);
        } else {
          try {
            const filePath = path.join(process.cwd(), 'server', 'user_data', `${userId}.json`);
            if (fs.existsSync(filePath)) {
                const raw = fs.readFileSync(filePath, 'utf8');
                const parsed = JSON.parse(raw);
                resultPayload = {
                  fitbuddy_questionnaire_progress: parsed.fitbuddy_questionnaire_progress ? JSON.parse(parsed.fitbuddy_questionnaire_progress) : null,
                  fitbuddy_workout_plan: parsed.fitbuddy_workout_plan ? JSON.parse(parsed.fitbuddy_workout_plan) : null,
                  fitbuddy_assessment_data: parsed.fitbuddy_assessment_data ? JSON.parse(parsed.fitbuddy_assessment_data) : null,
                  // include chat_history when present (stored as JSON string)
                  chat_history: parsed.chat_history ? ( (() => { try { return JSON.parse(parsed.chat_history); } catch { return parsed.chat_history; } })() ) : null,
                  accepted_terms: parsed.accepted_terms !== undefined ? parsed.accepted_terms : null,
                  accepted_privacy: parsed.accepted_privacy !== undefined ? parsed.accepted_privacy : null
                };
              console.log('[api/userdata] admin filesystem fallback loaded payload for', userId);
            }
          } catch (e) {
            console.error('[api/userdata] filesystem fallback error:', e);
          }
        }
      }

  if (!resultPayload) console.log('[api/userdata] admin fetch returned empty payload for userId:', userId);
  // Indicate source for client diagnostics
  const source = resultPayload ? (dbClient ? 'supabase' : 'filesystem') : 'none';
  try { res.setHeader('x-userdata-source', source); } catch (e) {}
  return res.status(200).json({ payload: resultPayload });
    }

    // POST /api/userdata/signin
    // Accepts an Authorization: Bearer <token> header or { token } in body.
    // Verifies the token with Supabase, returns the user's profile (from public.users or app_users) and stored userdata payload.
    if (action === 'signin' || req.url?.includes('/signin')) {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const body = req.body || {};
      const authHeader = String(req.headers.authorization || req.headers.Authorization || '').replace(/^Bearer\s*/i, '') || null;
      const token = authHeader || (body && body.token) || null;
      if (!token) return res.status(400).json({ error: 'token required' });
      if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

      try {
        // Resolve token -> user via Supabase
        const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_KEY as string);
        const { data: ud, error: userErr } = await client.auth.getUser(token);
        if (userErr || !ud || !ud.user) {
          console.error('[api/userdata] signin token verify failed:', userErr);
          return res.status(401).json({ error: 'Invalid token' });
        }
        const uid = ud.user.id;

        // Fetch profile: prefer app_users (app-specific), fall back to public.users
        let profile: any = null;
        try {
          const { data: appRow } = await supabase.from('app_users').select('*').eq('id', uid).limit(1).maybeSingle();
          if (appRow) profile = appRow;
        } catch (e) {
          // ignore
        }
        if (!profile) {
          try {
            const { data: pubRow } = await supabase.from('public.users').select('id, email, raw_user_meta_data, user_metadata, created_at').eq('id', uid).limit(1).maybeSingle();
            if (pubRow) profile = pubRow;
          } catch (e) {}
        }

        // Fetch stored payload from user_data table
        let payload: any = null;
        try {
          const { data, error } = await supabase.from('user_data').select('payload, accepted_terms, accepted_privacy, chat_history').eq('user_id', uid).limit(1).maybeSingle();
          if (error) {
            console.error('[api/userdata] payload fetch error:', error);
          } else {
            const payloadFromDb = data?.payload ?? null;
            const cols = { accepted_terms: data?.accepted_terms ?? null, accepted_privacy: data?.accepted_privacy ?? null, chat_history: data?.chat_history ?? null };
            if (payloadFromDb && typeof payloadFromDb === 'object') {
              // prefer explicit columns when present
              payload = { ...payloadFromDb };
              if (cols.accepted_terms !== null && cols.accepted_terms !== undefined) payload.accepted_terms = cols.accepted_terms;
              if (cols.accepted_privacy !== null && cols.accepted_privacy !== undefined) payload.accepted_privacy = cols.accepted_privacy;
              if (cols.chat_history !== null && cols.chat_history !== undefined) payload.chat_history = cols.chat_history;
            } else if (cols.accepted_terms !== null || cols.accepted_privacy !== null || cols.chat_history !== null) {
              // no payload but explicit columns present
              payload = sanitizePayload(cols) || null;
            } else {
              payload = payloadFromDb;
            }
          }
        } catch (e) {
          console.error('[api/userdata] payload fetch threw:', e);
        }

        // Normalize payload values: if strings, try JSON.parse; if object has .data, unwrap it.
        const normalizeVal = (v: any) => {
          if (v === null || v === undefined) return null;
          if (typeof v === 'string') {
            try {
              const parsed = JSON.parse(v);
              v = parsed;
            } catch (e) {
              // not JSON, return raw string
              return v;
            }
          }
          if (v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, 'data')) return v.data ?? null;
          return v;
        };
        if (payload && typeof payload === 'object') {
          try {
            payload.fitbuddy_workout_plan = normalizeVal(payload.fitbuddy_workout_plan);
            payload.fitbuddy_questionnaire_progress = normalizeVal(payload.fitbuddy_questionnaire_progress);
            payload.fitbuddy_assessment_data = normalizeVal(payload.fitbuddy_assessment_data);
            // New fields: normalize terms acceptance and chat history
            try { payload.accepted_terms = normalizeVal(payload.accepted_terms); } catch (e) {}
            try { payload.accepted_privacy = normalizeVal(payload.accepted_privacy); } catch (e) {}
            try {
              let ch = normalizeVal(payload.chat_history);
              // Ensure chat_history is an array if present
              if (ch && typeof ch === 'string') {
                try { ch = JSON.parse(ch); } catch (e) {}
              }
              payload.chat_history = Array.isArray(ch) ? ch : (ch ? [ch] : null);
            } catch (e) {}
          } catch (e) {
            console.warn('[api/userdata] payload normalization failed', e);
          }
        }

  // Remove explicit null keys before returning so clients don't receive null fields
  const returnPayload = payload && typeof payload === 'object' ? sanitizePayload(payload) : payload;
  try { res.setHeader('x-userdata-source', 'supabase'); } catch (e) {}
  return res.status(200).json({ ok: true, profile, payload: returnPayload, stored: returnPayload });
      } catch (e: any) {
        console.error('[api/userdata] signin unexpected error:', e);
        return res.status(500).json({ error: e?.message || 'Server error' });
      }
    }

    // POST /api/userdata/load
    if (action === 'load' || req.url?.includes('/load')) {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const body = req.body || {};
      const userId = body.userId || body.user_id || null;
      if (!userId) return res.status(400).json({ error: 'userId required' });
      if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

      try {
        const { data, error } = await supabase.from('user_data').select('payload, accepted_terms, accepted_privacy, chat_history').eq('user_id', String(userId)).limit(1).maybeSingle();
        if (error) {
          console.error('[api/userdata] load fetch error:', error);
          return res.status(500).json({ error: error.message || 'Fetch failed' });
        }
        try { res.setHeader('x-userdata-source', 'supabase'); } catch (e) {}
        const storedRaw = data?.payload ?? null;
        const storedCols: any = { accepted_terms: data?.accepted_terms ?? null, accepted_privacy: data?.accepted_privacy ?? null, chat_history: data?.chat_history ?? null };
        const normalizeVal = (v: any) => {
          if (v === null || v === undefined) return null;
          if (typeof v === 'string') {
            try { return JSON.parse(v); } catch (e) { return v; }
          }
          if (v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, 'data')) return v.data ?? null;
          return v;
        };
        let storedNorm: any = null;
        if (storedRaw && typeof storedRaw === 'object') {
          storedNorm = {
            fitbuddy_workout_plan: normalizeVal(storedRaw.fitbuddy_workout_plan),
            fitbuddy_questionnaire_progress: normalizeVal(storedRaw.fitbuddy_questionnaire_progress),
            fitbuddy_assessment_data: normalizeVal(storedRaw.fitbuddy_assessment_data)
          };
          try { if (storedCols.accepted_terms !== null && storedCols.accepted_terms !== undefined) storedNorm.accepted_terms = storedCols.accepted_terms; else storedNorm.accepted_terms = normalizeVal(storedRaw.accepted_terms); } catch (e) {}
          try { if (storedCols.accepted_privacy !== null && storedCols.accepted_privacy !== undefined) storedNorm.accepted_privacy = storedCols.accepted_privacy; else storedNorm.accepted_privacy = normalizeVal(storedRaw.accepted_privacy); } catch (e) {}
          try {
            let ch = storedCols.chat_history !== null && storedCols.chat_history !== undefined ? storedCols.chat_history : normalizeVal(storedRaw.chat_history);
            if (ch && typeof ch === 'string') {
              try { ch = JSON.parse(ch); } catch (e) {}
            }
            storedNorm.chat_history = Array.isArray(ch) ? ch : (ch ? [ch] : null);
          } catch (e) {}
          // Remove null keys before returning
          storedNorm = sanitizePayload(storedNorm) || null;
        } else {
          storedNorm = storedRaw;
        }
        return res.status(200).json({ ok: true, stored: storedNorm });
      } catch (e: any) {
        console.error('[api/userdata] load fetch threw:', e);
        return res.status(500).json({ error: e?.message || 'Fetch exception' });
      }
    }

    // GET /api/userdata/:userId
    if (req.method === 'GET') {
      const userId = req.query.userId || req.query?.[0];
      if (!userId) return res.status(400).json({ error: 'userId required' });
      if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
      const { data, error } = await supabase.from('user_data').select('payload, accepted_terms, accepted_privacy, chat_history').eq('user_id', userId).single();
      if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message || 'Fetch failed' });
      const payloadFromDb = data?.payload || null;
      const cols = { accepted_terms: data?.accepted_terms ?? null, accepted_privacy: data?.accepted_privacy ?? null, chat_history: data?.chat_history ?? null };
      if (payloadFromDb && typeof payloadFromDb === 'object') {
        const merged = { ...payloadFromDb };
        if (cols.accepted_terms !== null && cols.accepted_terms !== undefined) merged.accepted_terms = cols.accepted_terms;
        if (cols.accepted_privacy !== null && cols.accepted_privacy !== undefined) merged.accepted_privacy = cols.accepted_privacy;
        if (cols.chat_history !== null && cols.chat_history !== undefined) merged.chat_history = cols.chat_history;
        return res.status(200).json({ payload: merged });
      }
      if (cols.accepted_terms !== null || cols.accepted_privacy !== null || cols.chat_history !== null) {
        return res.status(200).json({ payload: sanitizePayload(cols) || null });
      }
      return res.status(200).json({ payload: payloadFromDb });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err: any) {
    console.error('[api/userdata/index] error', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
