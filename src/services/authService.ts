// Buy a shop item and update user on server and localStorage
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

    const res = await fetch('/api/user/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, item: safeItem })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.user) {
  localStorage.setItem('fitbuddy_user_data', JSON.stringify({ data: data.user, timestamp: Date.now() }));
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
    const res = await fetch(`/api/user/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.user) {
  localStorage.setItem('fitbuddy_user_data', JSON.stringify({ data: data.user, timestamp: Date.now() }));
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

import { saveUserData } from './localStorage';

export async function signIn(email: string, password: string): Promise<User> {
  const normalizedEmail = String(email).trim().toLowerCase();
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
  const raw = localStorage.getItem('fitbuddy_user_data');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.data || null;
  } catch {
    return null;
  }
}

export function signOut() {
  localStorage.removeItem('fitbuddy_user_data');
  localStorage.removeItem('fitbuddyUsername');
}
