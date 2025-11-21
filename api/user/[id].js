import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ message: 'User ID required.' });
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('fitbuddyai_userdata')
        .select('*')
        .eq('user_id', id)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error('Supabase error fetching user:', error);
        return res.status(500).json({ message: 'Supabase error.' });
      }
      if (!data) return res.status(404).json({ message: 'User not found.' });
      const { password, ...userSafe } = data;
      return res.status(200).json({ user: userSafe });
    }

    // POST actions for nested routes (workout_plan, assessment)
    if (req.method === 'POST') {
      const action = String(req.query.action || req.body?.action || '').toLowerCase();
      if (action === 'workout_plan') {
        // For now this app stores workout plan in user_data table; proxy to that API or return 404
        return res.status(404).json({ message: 'No workout plan found.' });
      }
      if (action === 'assessment') {
        return res.status(404).json({ message: 'No assessment found.' });
      }
      // Fallback: unsupported POST
      return res.status(400).json({ message: 'Bad request' });
    }
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}
