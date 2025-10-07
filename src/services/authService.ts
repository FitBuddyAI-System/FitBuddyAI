// Buy a shop item and update user on server and localStorage
import attachAuthHeaders from './apiAuth';
import { supabase } from './supabaseClient';
import { saveUserData, saveAuthToken, clearAuthToken, loadUserData } from './localStorage';

export async function buyShopItem(id: string, item: any): Promise<User | null> {
  try {
    // Send a minimal, safe payload (avoid sending React elements or functions)
    const safeItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      type: item.type,
      image: item.image || null,
      description: item.description || ''
    };

    const reqInit = await attachAuthHeaders({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, item: safeItem })
    });
    const res = await fetch('/api/user?action=buy', reqInit);
    if (!res.ok) {
      // Attempt to read structured error code from server
      try {
        const err = await res.json();
        console.warn('[buyShopItem] server error', err.code || err.message || res.status);
      } catch {
        console.warn('[buyShopItem] server error status', res.status);
      }
      return null;
    }
    const data = await res.json();
    if (data.user) {
      try { saveUserData({ data: data.user }); } catch {}
      return data.user;
    }
    return null;
  } catch {
    return null;
  }
}
// Fetch user from server by ID and update localStorage
export async function fetchUserById(id: string): Promise<User | null> {
  try {
    const useSupabase = Boolean(import.meta.env.VITE_LOCAL_USE_SUPABASE || import.meta.env.VITE_SUPABASE_URL);
    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('app_users').select('*').eq('id', id).limit(1).maybeSingle();
  if (error || !data) return null;
  try { saveUserData({ data }); } catch {}
  return data as User;
      } catch {
        return null;
      }
    }
    const res = await fetch(`/api/user/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.user) {
      try { saveUserData({ data: data.user }); } catch {}
      return data.user;
    }
    return null;
  } catch {
    return null;
  }
}
// src/services/authService.ts
export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  streak?: number;
  points?: number;
  energy?: number;
  workouts?: any[];
}

// imports moved to top

export async function signIn(email: string, password: string): Promise<User> {
  const normalizedEmail = String(email).trim().toLowerCase();
  const useSupabase = Boolean(import.meta.env.VITE_LOCAL_USE_SUPABASE || import.meta.env.VITE_SUPABASE_URL);
  if (useSupabase) {
    const result = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    // Supabase may return error with status 400 and message indicating "User is not confirmed" or similar.
    if (result.error || !result.data?.session) {
      const msg = result.error?.message || 'Sign in failed';
      // Detect common unconfirmed email message and throw a specific code
      if (/confirm|verify|not.*confirmed|email.*confirm/i.test(msg || '')) {
        const e: any = new Error('Email not confirmed');
        e.code = 'ERR_EMAIL_UNCONFIRMED';
        throw e;
      }
      throw new Error(msg);
    }
    // Store token and user for attachAuthHeaders/local usage
  const token = result.data.session.access_token;
    const user = result.data.user as any;
    // Determine username: prefer user_metadata.username, else fallback to email temporarily
    let usernameVal = (user.user_metadata && user.user_metadata.username) || null;
    if (!usernameVal) {
      // try to read from app_users table if present
      try {
        const { data: profile } = await supabase.from('app_users').select('username').eq('id', user.id).limit(1).maybeSingle();
        if (profile && profile.username) usernameVal = profile.username;
      } catch (e) {
        // ignore; we'll fallback to email
      }
    }
  const toSave = { data: { id: user.id, email: user.email, username: usernameVal || user.email, energy: (user.user_metadata && user.user_metadata.energy) || 0 } };
  // Clear any cross-tab 'no auto restore' guard set during sign-out so sign-in can persist data
  try { sessionStorage.removeItem('fitbuddy_no_auto_restore'); } catch {}
  try { localStorage.removeItem('fitbuddy_no_auto_restore'); } catch {}
  try { saveUserData({ data: toSave.data, token }, { skipBackup: true, forceSave: true } as any); } catch { /* ignore */ }
  try { if (token) saveAuthToken(token); } catch {}

    // Ensure Supabase user metadata includes a display name / username for this user.
    try {
      const displayName = toSave.data.username;
      if (displayName) {
        // Update the authenticated user's metadata with display name and username
        // supabase.auth.updateUser sets user metadata for the current session
        await supabase.auth.updateUser({ data: { display_name: displayName, username: displayName } });
      }
    } catch (e: any) {
      // Non-fatal: just log and continue
      console.warn('[authService] failed to update supabase user metadata', (e && (e as any).message) || String(e));
    }
    return toSave.data as User;
  }
  const res = await fetch('/api/auth?action=signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, password })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Sign in failed');
  }
  const data = await res.json();
  if (data.user) {
    // Persist unified user_data with optional token so attachAuthHeaders can find it
    const toSave = { data: data.user, token: data.token ?? null };
    try { saveUserData(toSave, { skipBackup: true }); } catch { /* ignore */ }
  }
  return data.user;
}

export async function signUp(email: string, username: string, password: string): Promise<User> {
  const normalizedEmail = String(email).trim().toLowerCase();
  const useSupabase = Boolean(import.meta.env.VITE_LOCAL_USE_SUPABASE || import.meta.env.VITE_SUPABASE_URL);
  if (useSupabase) {
    const result = await supabase.auth.signUp({ email: normalizedEmail, password, options: { data: { username, energy: 100 } } });
    if (result.error) throw new Error(result.error.message || 'Sign up failed');
    // Supabase may not return a session depending on config; if a session exists save token
    const token = result.data?.session?.access_token ?? null;
    const user = result.data?.user ?? null;
  const toSave = { data: user ? { id: user.id, email: user.email, username, energy: 100 } : null, token };
  try { sessionStorage.removeItem('fitbuddy_no_auto_restore'); } catch {}
  try { localStorage.removeItem('fitbuddy_no_auto_restore'); } catch {}
  try { saveUserData(toSave, { skipBackup: true, forceSave: true } as any); } catch { /* ignore */ }
    // Ensure server-side app_users and user_data rows exist for this new Supabase user
    try {
      if (user && user.id) {
        await fetch('/api/auth?action=create_profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: user.id, email: user.email, username })
        });
      }
    } catch (e) {
      console.warn('[authService] create_profile call failed', e);
    }

    return toSave.data as User;
  }
  const res = await fetch('/api/auth?action=signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, username, password })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Sign up failed');
  }
  const data = await res.json();
  if (data.user) {
  // Persist signup user data; token isn't issued on signup in current API
  const toSave = { data: data.user, token: data.token ?? null };
  try { saveUserData(toSave, { skipBackup: true }); } catch { /* ignore */ }
  }
  return data.user;
}

export function getCurrentUser(): User | null {
  try {
    const ud = loadUserData();
    return ud;
  } catch {
    return null;
  }
}

export function signOut() {
  try { clearAuthToken(); } catch {}
  try { sessionStorage.removeItem('fitbuddy_no_auto_restore'); } catch {}
  try { localStorage.removeItem('fitbuddy_no_auto_restore'); } catch {}
  try { const { clearUserData } = require('./localStorage'); clearUserData(); } catch {}
  try { sessionStorage.removeItem('fitbuddyUsername'); } catch {}
  // If using Supabase client, call signOut to clear its internal session
  try {
    if (supabase && typeof supabase.auth?.signOut === 'function') {
      supabase.auth.signOut().catch(() => {});
    }
  } catch (e) {}
}
