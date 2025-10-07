import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
	import.meta.env.VITE_SUPABASE_URL ||
	process.env.SUPABASE_URL;
const supabaseAnonKey =
	import.meta.env.VITE_SUPABASE_ANON_KEY ||
	process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error('Supabase URL and Key are required.');
}

// Do NOT persist Supabase sessions into localStorage. We want auth tokens
// only in sessionStorage (ephemeral) and never written to localStorage.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: { persistSession: false }
});
