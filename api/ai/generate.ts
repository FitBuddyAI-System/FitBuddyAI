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

// Accept multiple env var names so it works on Vercel, local dev, or when the
// key was mistakenly added with a VITE_/NEXT_PUBLIC_ prefix.
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY ||
  process.env.VITE_GEMINI_API_KEY ||
  process.env.NEXT_PUBLIC_GEMINI_API_KEY) as string | undefined;
const GEMINI_URL = GEMINI_API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`
  : null;

// Lightweight CORS helper so static builds and alternate origins can call this function
function applyCors(req: any, res: any) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Debug-Userdata, x-debug-userdata');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  } catch (e) {
    // ignore header write errors
  }
  if (req.method === 'OPTIONS') {
    try { res.status(200).end(); } catch { try { res.end(); } catch {} }
    return true;
  }
  return false;
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  try {
    // Accept either { prompt: string, userId, meta } or the Google-style
    // { contents: [{ parts: [{ text: '...' }] }] } payload. This makes the
    // endpoint more forgiving for direct testing tools that post the
    // generative API shaped object.
    // Be forgiving about the incoming body shape. Sometimes dev servers
    // provide the raw body as a string, or callers post slightly different
    // shapes (prompt, contents, inputs, messages). Normalize to an object
    // and extract the most-likely prompt field.
    let body: any = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        // leave as string — we'll try other fallbacks below
      }
    }

    let prompt: string | undefined = undefined;

    // Helper: join text from parts array
    const joinPartsText = (parts: any) => {
      try {
        if (!Array.isArray(parts)) return '';
        return parts
          .map((p: any) => {
            if (typeof p === 'string') return p;
            if (p == null) return '';
            return p.text ?? p.content ?? '';
          })
          .filter(Boolean)
          .join('\n');
      } catch (e) {
        return '';
      }
    };

    // 1) direct prompt field
    if (typeof body.prompt === 'string' && body.prompt.trim().length > 0) {
      prompt = body.prompt.trim();
    }

    // 2) Google-style contents -> parts -> text (join all parts)
    if (!prompt && Array.isArray(body.contents)) {
      for (const c of body.contents) {
        if (!c) continue;
        if (typeof c === 'string') {
          if (c.trim()) {
            prompt = c.trim();
            break;
          }
        }
        const joined = joinPartsText(c.parts ?? c);
        if (joined) {
          prompt = joined;
          break;
        }
      }
    }

    // 3) inputs array (some clients)
    if (!prompt && Array.isArray(body.inputs) && body.inputs.length > 0) {
      const inp = body.inputs[0];
      if (typeof inp === 'string') prompt = inp;
      else if (typeof inp.content === 'string') prompt = inp.content;
      else {
        const j = joinPartsText(inp.parts ?? inp);
        if (j) prompt = j;
      }
    }

    // 4) chat-like messages (use last message)
    if (!prompt && Array.isArray(body.messages) && body.messages.length > 0) {
      const last = body.messages[body.messages.length - 1];
      if (last) {
        if (typeof last === 'string') prompt = last;
        else if (typeof last.content === 'string') prompt = last.content;
        else if (last.content && typeof last.content.text === 'string') prompt = last.content.text;
        else {
          const j = joinPartsText(last.parts ?? last.content ?? last);
          if (j) prompt = j;
        }
      }
    }

    // 5) If contents[0].parts[0].text is a JSON-stringified payload, try parsing/joining
    if (!prompt && Array.isArray(body.contents) && body.contents[0]) {
      const maybeParts = body.contents[0].parts ?? body.contents[0];
      const firstText = Array.isArray(maybeParts) && maybeParts[0] ? maybeParts[0].text ?? maybeParts[0] : undefined;
      if (typeof firstText === 'string') {
        try {
          const parsed = JSON.parse(firstText);
          if (typeof parsed === 'string' && parsed.trim()) prompt = parsed.trim();
        } catch (_) {
          // not JSON — ignore
        }
      }
    }

    // 6) Fallback: shallow DFS search for a 'text' or 'prompt' string anywhere in body
    if (!prompt) {
      const stack = [body];
      const visited = new Set();
      while (stack.length) {
        const node = stack.shift();
        if (!node || visited.has(node)) continue;
        visited.add(node);
        if (typeof node === 'string') {
          if (node.trim().length > 0) {
            prompt = node.trim();
            break;
          }
        } else if (typeof node === 'object') {
          if (typeof node.text === 'string' && node.text.trim()) { prompt = node.text.trim(); break; }
          if (typeof node.prompt === 'string' && node.prompt.trim()) { prompt = node.prompt.trim(); break; }
          for (const k of Object.keys(node)) {
            try { stack.push((node as any)[k]); } catch (e) { /* ignore */ }
          }
        }
      }
    }

    // 7) Aggressive raw-text fallback: search the full serialized body for any
    // occurrences of "text":"..." and join them. This helps when parts are
    // double-serialized or the client sent a stringified JSON blob.
    if (!prompt) {
      try {
        const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        const re = /"text"\s*:\s*"((?:\\\\.|[^"\\\\])*)"/g;
        const found: string[] = [];
        let m: RegExpExecArray | null = null;
        while ((m = re.exec(raw)) !== null) {
          try {
            // unescape using JSON parser
            const un = JSON.parse('"' + m[1] + '"');
            if (typeof un === 'string' && un.trim()) found.push(un.trim());
          } catch (_) {
            if (m[1].trim()) found.push(m[1].trim());
          }
        }
        if (found.length) prompt = found.join('\n\n');
      } catch (e) {
        // ignore
      }
    }

    const userId = body.userId;
    const meta = body.meta;
    if (!prompt) {
      // DEBUG: Always return diagnostics for missing prompt so we can see
      // exactly what the client sent. Remove or guard this in production.
      const sample = (() => {
        try {
          if (typeof body === 'string') return body.slice(0, 2000);
          return JSON.stringify(body, null, 2).slice(0, 2000);
        } catch (e) {
          return String(body).slice(0, 2000);
        }
      })();
      const diag: any = {
        message: 'Missing prompt',
        bodyType: typeof body,
        bodySample: sample,
        headers: { 'content-type': req.headers['content-type'] || req.headers['Content-Type'] || null }
      };
      return res.status(400).json(diag);
    }

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
      // Feature under development: return a short human-friendly message
      // rather than a fabricated plan JSON so the UI shows a clear status.
      generatedText = 'Sorry, this feature is currently under development.';
    } else {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!generatedText || String(generatedText).trim().length === 0) {
        generatedText = 'Sorry, this feature is currently under development.';
      }
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
