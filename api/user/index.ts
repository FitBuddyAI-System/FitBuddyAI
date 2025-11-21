import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string | undefined;
const SUPABASE_KEY = process.env.SUPABASE_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[api/user/index] Missing SUPABASE_URL or SUPABASE_KEY in environment');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const id = String(req.query?.id || req.body?.id || '');
    if (!id) return res.status(400).json({ code: 'ERR_INVALID_INPUT', message: 'User id required.' });

    if (req.method === 'GET') {
      const { data, error } = await supabase.from('fitbuddyai_userdata').select('*').eq('user_id', id).limit(1).maybeSingle();
      if (error) {
        console.error('[api/user/index] supabase error', error);
        return res.status(500).json({ message: 'Supabase error.' });
      }
      if (!data) return res.status(404).json({ message: 'User not found.' });
      const { password, ...safe } = data as any;
      return res.status(200).json({ user: safe });
    }

    if (req.method === 'POST') {
      const action = String(req.query?.action || req.body?.action || '').toLowerCase();
      if (action === 'workout_plan') {
        // In this project the workout plan is stored in server/user_data or proxied via userdata handler.
        // Forward to userdata admin endpoint if present.
        // Minimal implementation: return 404 to mirror previous behavior.
        return res.status(404).json({ code: 'ERR_NOT_FOUND', message: 'No workout plan found.' });
      }
      if (action === 'assessment') {
        return res.status(404).json({ code: 'ERR_NOT_FOUND', message: 'No assessment found.' });
      }
      if (action === 'update') {
        // Update a user's basic profile (username, avatar). Accepts body { id, username, avatar }
        const body = req.body || {};
        const uid = String(body.id || id || '');
        if (!uid) return res.status(400).json({ code: 'ERR_INVALID_INPUT', message: 'User id required for update.' });
        const updates: any = {};
        if (body.username !== undefined) updates.username = body.username;
        if (body.avatar !== undefined) updates.avatar_url = body.avatar;
        if (Object.keys(updates).length === 0) return res.status(400).json({ code: 'ERR_INVALID_INPUT', message: 'No update fields provided.' });
        const { data, error } = await supabase.from('fitbuddyai_userdata').update(updates).eq('user_id', uid).select().limit(1).maybeSingle();
        if (error) {
          console.error('[api/user/index] update error', error);
          return res.status(500).json({ code: 'ERR_INTERNAL', message: 'Failed to update user.' });
        }
        const { password, ...safe } = (data as any) || {};

        // Attempt to update Supabase auth user metadata (display name / username) using admin API.
        // This is non-fatal; if it fails we still return the updated app_users record.
        try {
          if (supabase && typeof (supabase.auth as any)?.admin?.updateUserById === 'function') {
            // supabase-js v2 admin API
            await (supabase.auth as any).admin.updateUserById(uid, { user_metadata: { display_name: safe.username, username: safe.username } });
          } else if (supabase && typeof (supabase.auth as any)?.updateUser === 'function') {
            // fallback: try to update metadata for current session (may be no-op on server)
            try {
              await (supabase.auth as any).updateUser({ data: { display_name: safe.username, username: safe.username } });
            } catch (e) {
              // ignore fallback errors
            }
          } else {
            // No admin API available - log and continue
            console.warn('[api/user/index] supabase admin update not available to update auth metadata');
          }
        } catch (e) {
          console.warn('[api/user/index] failed to update supabase auth metadata', e && (e as any).message ? (e as any).message : String(e));
        }

        return res.status(200).json({ user: safe });
      }

      if (action === 'buy') {
        // Purchase an item: body { id, item }
        const body = req.body || {};
        const uid = String(body.id || id || '');
        const item = body.item || null;
        if (!uid) return res.status(400).json({ code: 'ERR_INVALID_INPUT', message: 'User id required.' });
        if (!item || typeof item !== 'object') return res.status(400).json({ code: 'ERR_INVALID_INPUT', message: 'Item required.' });
        const price = Number(item.price || 0);
        if (isNaN(price) || price < 0) return res.status(400).json({ code: 'ERR_INVALID_INPUT', message: 'Invalid item price.' });

        // Require Authorization header and validate token with Supabase
        const authHeader = String(req.headers.authorization || req.headers.Authorization || '');
        const token = authHeader && authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
        if (!token) return res.status(401).json({ code: 'ERR_AUTH_MISSING', message: 'Missing Authorization token.' });

        if (!SUPABASE_URL || !SUPABASE_KEY) {
          console.error('[api/user/index] Supabase not configured for token verification');
          return res.status(500).json({ code: 'ERR_INTERNAL', message: 'Server not configured for token verification.' });
        }

        try {
          const { data: authData, error: authErr } = await supabase.auth.getUser(token);
          if (authErr || !authData || !authData.user) {
            console.warn('[api/user/index] token verification failed', authErr);
            return res.status(401).json({ code: 'ERR_AUTH_INVALID', message: 'Invalid or expired token.' });
          }
          const decodedId = authData.user.id;
          if (decodedId !== uid) {
            console.warn('[api/user/index] token user id mismatch', { decodedId, requestedId: uid });
            return res.status(403).json({ code: 'ERR_AUTH_MISMATCH', message: 'Token does not match user.' });
          }
        } catch (e) {
          console.error('[api/user/index] token verification error', e);
          return res.status(401).json({ code: 'ERR_AUTH_INVALID', message: 'Invalid or expired token.' });
        }

        // Fetch user
        const { data: userData, error: fetchErr } = await supabase.from('fitbuddyai_userdata').select('*').eq('user_id', uid).limit(1).maybeSingle();
        if (fetchErr) {
          console.error('[api/user/index] buy supabase fetch error', fetchErr);
          return res.status(500).json({ code: 'ERR_INTERNAL', message: 'Failed to fetch user.' });
        }
        if (!userData) return res.status(404).json({ code: 'ERR_NOT_FOUND', message: 'User not found.' });

        const currentEnergy = Number((userData as any).energy || 0);
        if (currentEnergy < price) return res.status(409).json({ code: 'ERR_INSUFFICIENT_FUNDS', message: 'Insufficient energy to purchase item.' });

        // Prepare inventory update (assume inventory is a JSON array column on app_users)
        const existingInventory = Array.isArray((userData as any).inventory) ? (userData as any).inventory : [];
        const newInventory = [...existingInventory, item];
        const newEnergy = currentEnergy - price;

        const { data: updated, error: updateErr } = await supabase.from('fitbuddyai_userdata').update({ inventory: newInventory, energy: newEnergy }).eq('user_id', uid).select().maybeSingle();
        if (updateErr) {
          console.error('[api/user/index] buy supabase update error', updateErr);
          return res.status(500).json({ code: 'ERR_INTERNAL', message: 'Failed to update user.' });
        }
        if (!updated) return res.status(500).json({ code: 'ERR_INTERNAL', message: 'Failed to update user.' });

        const { password, ...userSafe } = (updated as any) || {};
        return res.status(200).json({ user: userSafe });
      }

      return res.status(400).json({ code: 'ERR_INVALID_ACTION', message: 'Unsupported action.' });
    }
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (err) {
    console.error('[api/user/index] error', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}
