// Buy a shop item and update user on server and localStorage
import attachAuthHeaders from './apiAuth';
import { supabase } from './supabaseClient';
import { saveUserData, saveAuthToken, clearAuthToken, loadUserData, clearUserData } from './localStorage';
import { ensureUserId } from '../utils/userHelpers';

const DEFAULT_ENERGY = 10000;

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
        const { data, error } = await supabase.from('fitbuddyai_userdata').select('*').eq('user_id', id).limit(1).maybeSingle();
        if (error || !data) return null;
        const normalized = ensureUserId(data);
        try { saveUserData({ data: normalized }); } catch {}
        return normalized as User;
      } catch {
        return null;
      }
    }
    const res = await fetch(`/api/user/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.user) {
      const nextEnergy = data.user.energy ?? DEFAULT_ENERGY;
      const next = { ...data.user, energy: nextEnergy };
      try { saveUserData({ data: next }); } catch {}
      return next;
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
  inventory?: any[];
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
    const session = result.data.session;
    const token = session?.access_token ?? null;
    const user = result.data.user as any;
    // Determine username: prefer user_metadata.username, else fallback to email temporarily
    let usernameVal = (user.user_metadata && user.user_metadata.username) || null;
    if (!usernameVal) {
      // try to read from app_users table if present
    try {
        const { data: profile } = await supabase.from('fitbuddyai_userdata').select('username').eq('user_id', user.id).limit(1).maybeSingle();
        if (profile && profile.username) usernameVal = profile.username;
      } catch (e) {
        // ignore; we'll fallback to email
      }
    }
    // Send refresh token to server for server-side storage and set HttpOnly cookie.
    try {
      await fetch('/api/auth?action=store_refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, refresh_token: session?.refresh_token })
      });
    } catch (e) {
      // Non-fatal: if server-side storage fails, continue without it.
      console.warn('[authService] failed to store refresh token server-side', e);
    }
  const fallbackEnergy = (user.user_metadata && user.user_metadata.energy) ?? DEFAULT_ENERGY;
  const toSave = { data: { id: user.id, email: user.email, username: usernameVal || user.email, energy: fallbackEnergy } };
  // Clear any cross-tab 'no auto restore' guard set during sign-out so sign-in can persist data
  try { sessionStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
  try { localStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
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
    const nextEnergy = data.user.energy ?? DEFAULT_ENERGY;
    const nextUser = { ...data.user, energy: nextEnergy };
    const toSave = { data: nextUser, token: data.token ?? null };
    // forceSave to bypass any temporary guards (e.g., from a calendar clear) so reloads stay signed in
    try { saveUserData(toSave, { skipBackup: true, forceSave: true } as any); } catch { /* ignore */ }
  }
  return { ...data.user, energy: data.user.energy ?? DEFAULT_ENERGY };
}

export async function signUp(email: string, username: string, password: string): Promise<User> {
  const normalizedEmail = String(email).trim().toLowerCase();
  const useSupabase = Boolean(import.meta.env.VITE_LOCAL_USE_SUPABASE || import.meta.env.VITE_SUPABASE_URL);
  if (useSupabase) {
    const result = await supabase.auth.signUp({ email: normalizedEmail, password, options: { data: { username, energy: DEFAULT_ENERGY } } });
    if (result.error) throw new Error(result.error.message || 'Sign up failed');
    // Supabase may not return a session depending on config; if a session exists save token
    const session = result.data?.session ?? null;
    const token = session?.access_token ?? null;
    const user = result.data?.user ?? null;
  const toSave = user ? { id: user.id, email: user.email, username, energy: DEFAULT_ENERGY } : null;
  // Only persist client-side if we actually received a session/token. For email-verify flows
  // Supabase may require the user to confirm via email before signing in; do not mark them
  // as signed-in (or persist their profile) until a token exists.
    try {
      await fetch('/api/auth?action=store_refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, refresh_token: session?.refresh_token })
      });
    } catch (e) {
      console.warn('[authService] failed to store refresh token server-side', e);
    }
  if (token && toSave) {
    try { sessionStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
    try { localStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
    try { saveUserData({ data: toSave, token }, { skipBackup: true, forceSave: true } as any); } catch { /* ignore */ }
  }
    // Ensure server-side app_users and user_data rows exist for this new Supabase user (best-effort).
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

    return toSave as unknown as User;
  }
  const res = await fetch('/api/auth?action=signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, username, password })
  });
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch {}
    const err = new Error((data && data.message) || 'Sign up failed');
    // Attach structured code if present
    if (data && data.code) (err as any).code = data.code;
    throw err;
  }
  const data = await res.json();
  if (data.user) {
  // Persist signup user data; token isn't issued on signup in current API
  const toSave = { data: data.user, token: data.token ?? null };
  // forceSave to ensure persistence even if a guard flag is set
  try { saveUserData(toSave, { skipBackup: true, forceSave: true } as any); } catch { /* ignore */ }
  }
  return data.user;
}

// Initiate Google OAuth sign-in (client-side). When running against Supabase this will
// redirect the browser to Google's OAuth consent screen and back to the app. For
// non-Supabase local server mode this function currently throws to indicate it's
// unsupported.
export async function signInWithGoogle(): Promise<void> {
  const useSupabase = Boolean(import.meta.env.VITE_LOCAL_USE_SUPABASE || import.meta.env.VITE_SUPABASE_URL);
  if (useSupabase) {
    try {
      // Prefer an explicit public app URL (so Supabase redirects back to your
      // branded domain after it finishes the provider exchange). If you set
      // VITE_PUBLIC_APP_URL in your .env (for example https://app.fitbuddyai.com)
      // Supabase will redirect there after handling the OAuth callback.
  // Build an explicit redirectTo that points back to the exact page the
  // user started the flow from. Supabase will redirect the browser back to
  // this URL after it finishes the provider exchange.
  const envPublic = (import.meta.env.VITE_PUBLIC_APP_URL && String(import.meta.env.VITE_PUBLIC_APP_URL).trim()) || '';
  const currentFullUrl = window.location.origin + window.location.pathname + window.location.search + window.location.hash;
  const redirectTo = (envPublic && envPublic !== 'PUT_YOUR_PUBLIC_APP_URL_HERE') ? envPublic.replace(/\/$/, '') + window.location.pathname : currentFullUrl;
  console.log('[authService] initiating Google sign-in, redirectTo=', redirectTo);
  await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      return;
    } catch (e) {
      console.warn('[authService] Google sign-in failed', e);
      throw e;
    }
  }
  // If Supabase isn't available in this environment, surface an error so UI can
  // show a helpful message. Implement server-side OAuth flow if needed.
  throw new Error('Google sign-in is not available in this environment.');
}

// Send a Google ID token (credential) to the server for verification and session creation.
// The server should verify the token with Google's tokeninfo endpoint or using
// Google's public keys, then create or link a user and return a session payload.
export async function signInWithGoogleCredential(idToken: string): Promise<any> {
  try {
    const res = await fetch('/api/auth?action=google_id_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken })
    });
    if (!res.ok) {
      let data = null;
      try { data = await res.json(); } catch {}
      throw new Error((data && data.message) || `Google ID token sign-in failed (${res.status})`);
    }
    const data = await res.json();
    // If the server returned a consolidated user payload, persist it locally
    if (data && data.user) {
      try { saveUserData({ data: data.user, token: data.token ?? null }, { skipBackup: true } as any); } catch {}
    }
    return data;
  } catch (e) {
    console.warn('[authService] signInWithGoogleCredential error', e);
    throw e;
  }
}

export function getCurrentUser(): User | null {
  try {
    const ud = loadUserData();
    return ud;
  } catch {
    return null;
  }
}

// Sign out helpers
// `signOutAndRevoke` is async and will attempt to revoke the server-side
// refresh token before clearing local state. It waits briefly (default 2s)
// for the revoke to complete but will continue if the server is slow.
export async function signOutAndRevoke(timeoutMs = 2000): Promise<void> {
  // Attempt to clear server-side stored refresh token. Prefer `sendBeacon`
  // during unloads; fall back to a short-await fetch to ensure revocation.
  try {
    const revokeUrl = '/api/auth?action=clear_refresh';
    let revoked = false;
    // try navigator.sendBeacon first (non-blocking, reliable during unload)
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
        try { revoked = navigator.sendBeacon(revokeUrl, blob); } catch { revoked = false; }
      }
    } catch {
      revoked = false;
    }

    if (!revoked) {
      // Fall back to fetch with a timeout to avoid blocking too long.
      try {
        await Promise.race([
          fetch(revokeUrl, { method: 'POST', credentials: 'include' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('revoke_timeout')), timeoutMs))
        ]);
      } catch (e) {
        console.warn('[authService] signOut: clear_refresh request failed or timed out', e);
      }
    }
  } catch (e) {
    console.warn('[authService] signOut: revoke attempt failed', e);
  }

  // Clear client-side state (tokens, persisted user data, guards)
  try { clearAuthToken(); } catch {}
  try { sessionStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
  try { localStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
  try { clearUserData(); } catch {}
  try { sessionStorage.removeItem('fitbuddyaiUsername'); } catch {}

  // If using Supabase client, call signOut to clear its internal session
  try {
    if (supabase && typeof supabase.auth?.signOut === 'function') {
      await supabase.auth.signOut().catch(() => {});
    }
  } catch {
    // ignore
  }
}

// Backwards-compatible synchronous wrapper: fire-and-forget sign-out.
export function signOut(): void {
  // Do not await here to preserve existing call sites that expect a void return.
  void signOutAndRevoke().catch((e) => console.warn('[authService] signOut error', e));
}
