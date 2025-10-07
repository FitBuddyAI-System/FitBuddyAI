import { supabase } from './supabaseClient';
import { getAuthToken } from './localStorage';

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
      // Prefer session storage token which is not persisted across browser restarts
      const token = getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      // ignore
    }
  }
  return { ...(init || {}), headers } as RequestInit;
}

export default attachAuthHeaders;
