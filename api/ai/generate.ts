import { createClient } from '@supabase/supabase-js';

// Make env usage defensive so local dev without keys fails clearly or uses a mock fallback
const SUPABASE_URL = process.env.SUPABASE_URL as string | undefined;
const SUPABASE_KEY = process.env.SUPABASE_KEY as string | undefined;
let supabase: any = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (e) {
    console.warn('[api/ai/generate] failed to create supabase client', String(e));
    supabase = null;
  }
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY as string | undefined;
const GEMINI_URL = GEMINI_API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`
  : null;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const { prompt, userId, meta } = req.body;
    if (!prompt) return res.status(400).json({ message: 'Missing prompt' });

    // Call Gemini (or use a local mock when key is missing and we're in dev)
    let generatedText = '';
    if (!GEMINI_URL) {
      const allowMock = process.env.LOCAL_AI_MOCK === '1' || process.env.NODE_ENV !== 'production';
      if (!allowMock) {
        return res.status(500).json({ message: 'AI provider not configured', diagnostic: { env_GEMINI_API_KEY_present: false } });
      }
      console.warn('[api/ai/generate] GEMINI_API_KEY missing — returning local mock response (development)');
      // Minimal valid WorkoutPlan JSON to satisfy client parsing
      const today = new Date().toISOString().split('T')[0];
      const mockPlan = {
        id: `mock-${Date.now()}`,
        name: 'Local Mock Plan',
        description: 'This is a local mock workout plan used when GEMINI API key is not configured.',
        startDate: today,
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        totalDays: 7,
        totalTime: '30 minutes',
        weeklyStructure: ['Monday','Wednesday','Friday'],
        dailyWorkouts: [
          {
            date: today,
            type: 'strength',
            completed: false,
            totalTime: '30 minutes',
            workouts: [
              { name: 'Bodyweight Squats', difficulty: 'beginner', duration: '10 minutes', reps: 12, muscleGroups: ['legs'], equipment: [], description: 'Simple squats.' }
            ],
            alternativeWorkouts: []
          }
        ]
      };
      generatedText = JSON.stringify(mockPlan);
    } else {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    // Log to audit_logs if supabase is configured
    try {
      if (supabase) {
        await supabase.from('audit_logs').insert({
          user_id: userId || null,
          event: 'ai_response',
          action: { prompt, response: generatedText, meta },
          ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
          user_agent: req.headers['user-agent'] || null,
          verified: false
        });
      }
    } catch (e) {
      console.warn('Failed to insert audit log', e);
    }

    res.json({ text: generatedText });
  } catch (err: any) {
    console.error('AI generate error', err);
    res.status(500).json({ message: 'AI generation failed' });
  }
}
