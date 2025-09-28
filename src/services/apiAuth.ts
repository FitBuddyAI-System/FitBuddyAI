import { supabase } from './supabaseClient';

export async function attachAuthHeaders(init?: RequestInit) {
  const headers: any = init && init.headers ? { ...(init.headers as any) } : {};
  try {
    if (supabase && typeof supabase.auth?.getSession === 'function') {
      const r = await supabase.auth.getSession();
      const token = r?.data?.session?.access_token ?? null;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (e) {
    // ignore
  }
  if (!headers['Authorization']) {
    try {
      const raw = localStorage.getItem('fitbuddy_user_data');
      const parsed = raw ? JSON.parse(raw) : null;
      const token = parsed?.data?.token ?? parsed?.token ?? null;
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      // ignore
    }
  }
  return { ...(init || {}), headers } as RequestInit;
}

export default attachAuthHeaders;
