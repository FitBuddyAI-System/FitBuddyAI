import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : undefined);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!url || !key) {
  // Do not throw here to keep server startable in local dev without service key
  console.warn('Supabase admin client missing URL or service key. Server admin actions will fail until configured.');
}

export const supabaseAdmin = (url && key) ? createClient(url, key) : null;
