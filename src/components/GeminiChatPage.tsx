import React, { useEffect, useRef, useState } from 'react';
import './GeminiChatPage.css';
import { getAITextResponse } from '../services/aiService';
// ActionConfirmModal removed: actions are applied automatically

interface GeminiChatPageProps {
  userData?: any;
}

const GeminiChatPage: React.FC<GeminiChatPageProps> = ({ userData }) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant' | 'action'; text: string }>>([
    { role: 'assistant', text: 'Hi! I am Buddy — your AI Fitness assistant. I can answer questions about your workouts, goals, and progress.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  // confirmation modal removed: actions will be applied automatically
  const isRestoringRef = useRef(false);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Persist messages per-user to localStorage
  useEffect(() => {
    // load messages for this user on mount / when userData changes
    const loadForUser = () => {
      try {
        const uid = userData?.id || 'anon';
        const raw = localStorage.getItem(`fitbuddy_chat_${uid}`);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      } catch (err) {
        // ignore
      }
    };
    loadForUser();

    // Also attempt to restore from server when a user signs in or when the component mounts for a signed-in user
    const tryRestoreFromServer = async () => {
      try {
        isRestoringRef.current = true;
        const uid = userData?.id;
        if (!uid) return;
        const mod = await import('../services/cloudBackupService');
        await mod.restoreUserDataFromServer(String(uid));
        // After restore, reload local storage key
        const raw = localStorage.getItem(`fitbuddy_chat_${uid}`);
        isRestoringRef.current = false;
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      } catch (e) {
        isRestoringRef.current = false;
        // ignore restore errors
      }
    };
    tryRestoreFromServer();
  }, [userData?.id]);

  // Reload chat progress when the user logs in (cross-tab or after sign-in)
  useEffect(() => {
    const onLogin = async () => {
      try {
        isRestoringRef.current = true;
        const uid = userData?.id;
        if (!uid) return;
        const mod = await import('../services/cloudBackupService');
        await mod.restoreUserDataFromServer(String(uid));
        const raw = localStorage.getItem(`fitbuddy_chat_${uid}`);
        isRestoringRef.current = false;
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      } catch (e) {}
    };
    window.addEventListener('fitbuddy-login', onLogin);
    // Also restore when the chat tab is explicitly opened via header click
    const onOpen = async () => {
      try {
        isRestoringRef.current = true;
        const uid = userData?.id;
        if (!uid) return;
        const mod = await import('../services/cloudBackupService');
        await mod.restoreUserDataFromServer(String(uid));
        const raw = localStorage.getItem(`fitbuddy_chat_${uid}`);
        isRestoringRef.current = false;
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      } catch (e) {}
    };
    window.addEventListener('fitbuddy-open-chat', onOpen as EventListener);
    return () => window.removeEventListener('fitbuddy-login', onLogin);
    // cleanup for onOpen handled by removing the other listener when component unmounts
  }, [userData?.id]);

  // Cross-tab sync: listen for storage events to update messages when another tab modifies the chat key
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      try {
        if (!e.key) return;
        const uid = userData?.id || 'anon';
        const expectedKey = `fitbuddy_chat_${uid}`;
        if (e.key === expectedKey) {
          if (!e.newValue) {
            // removed in another tab: reset to assistant greeting
            setMessages([{ role: 'assistant', text: 'Hi! I am Buddy — your AI Fitness assistant. I can answer questions about your workouts, goals, and progress.' }]);
            return;
          }
          try {
            const parsed = JSON.parse(e.newValue);
            if (Array.isArray(parsed)) setMessages(parsed);
          } catch {}
        }
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [userData?.id]);

  // Debounced save of chat messages
  useEffect(() => {
    let t: any = null;
    try {
      t = setTimeout(() => {
        try {
          // If a restore is in progress for this tab, skip saving to avoid overwriting restored data
          if (isRestoringRef.current) return;
          const uid = userData?.id || 'anon';
          // Avoid persisting the default assistant greeting immediately (it may overwrite restored chat)
          const defaultGreeting = 'Hi! I am Buddy — your AI Fitness assistant. I can answer questions about your workouts, goals, and progress.';
          if (messages.length === 1 && messages[0].role === 'assistant' && messages[0].text === defaultGreeting) return;
          localStorage.setItem(`fitbuddy_chat_${uid}`, JSON.stringify(messages));
        } catch {}
      }, 400);
    } catch {}
    return () => { if (t) clearTimeout(t); };
  }, [messages, userData?.id]);

  // Clear chat state on logout
  useEffect(() => {
    const onLogout = () => {
      try {
        const uid = userData?.id || 'anon';
        localStorage.removeItem(`fitbuddy_chat_${uid}`);
        setMessages([{ role: 'assistant', text: 'Hi! I am Buddy — your AI fitness assistant. I can answer questions about your workouts, goals, and progress.' }]);
      } catch {}
    };
    window.addEventListener('fitbuddy-logout', onLogout);
    return () => window.removeEventListener('fitbuddy-logout', onLogout);
  }, [userData?.id]);

  // Clear anon chat when a user signs in (anon -> real user)
  useEffect(() => {
    // remember previous id to detect transitions
    let prevId: string | undefined = undefined;
    const handle = () => {
      const currentId = userData?.id;
      // if previous was undefined/null or 'anon' and now we have a real id, clear anon data
      if ((prevId === undefined || prevId === 'anon') && currentId && currentId !== 'anon') {
        try {
          // transfer anon chat into the user's chat key so history isn't lost
          const anonRaw = localStorage.getItem('fitbuddy_chat_anon');
          if (anonRaw) {
            try {
              localStorage.setItem(`fitbuddy_chat_${currentId}`, anonRaw);
            } catch {}
          }
          // remove anon key
          localStorage.removeItem('fitbuddy_chat_anon');
        } catch {}
      }
      prevId = currentId ?? 'anon';
    };
    // run once on mount and whenever userData.id changes
    handle();
    return () => { /* nothing */ };
  }, [userData?.id]);

  const summarizeUser = (u: any) => {
    if (!u) return 'No user data available.';
    try {
      const safe = {
        id: u.id,
        username: u.username,
        age: u.age,
        goals: u.goals || u.preferences || [],
        fitnessLevel: u.fitnessLevel || u.fitness_level || 'unknown',
        energy: u.energy ?? null,
        streak: u.streak ?? null
      };
      return JSON.stringify(safe);
    } catch {
      return 'User data present but could not be summarized.';
    }
  };

  // Remove any visible action JSON from assistant reply text (fenced ```json``` blocks or inline JSON with "__action").
  const removeActionJsonFromText = (text: string) => {
    if (!text) return text;
    let t = String(text);
    try {
      // Remove fenced json/code blocks first
      t = t.replace(/```json[\s\S]*?```/gi, '');
      t = t.replace(/```[\s\S]*?```/g, '');

      // Remove any inline JSON objects that contain "__action"
      while (t.includes('"__action"')) {
        const marker = '"__action"';
        const mi = t.indexOf(marker);
        if (mi === -1) break;
        const before = t.lastIndexOf('{', mi);
        if (before === -1) break;
        let depth = 0;
        let end = -1;
        for (let i = before; i < t.length; i++) {
          const ch = t[i];
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) { end = i; break; }
          }
        }
        if (end !== -1) {
          t = (t.slice(0, before) + t.slice(end + 1)).trim();
        } else {
          break;
        }
      }

      // As a final cleanup remove any leftover single-line JSON-looking fragments
      t = t.replace(/\{[^\}]*__action[^\}]*\}/g, '');
      // Collapse multiple blank lines
      t = t.replace(/\n{3,}/g, '\n\n');
      return t.trim();
    } catch (e) {
      return text;
    }
  };

  // Apply an action automatically (no confirmation modal). Appends a human-readable reply
  // and then an action summary (transformed to past-tense where possible).
  const applyAction = async (actionJson: any, humanReplyText: string) => {
    try {
      const normalizedUpdates = (actionJson.updates || []).map((u: any) => {
        try {
          if (u.path === 'workoutPlan' && typeof u.value === 'string') {
            try { u.value = JSON.parse(u.value); } catch { /* leave as-is */ }
          }
        } catch {}
        return u;
      });
      const filtered = { ...actionJson, updates: normalizedUpdates };

      const rawSaved = localStorage.getItem('fitbuddy_user_data');
      const parsed = rawSaved ? JSON.parse(rawSaved) : null;
      const userId = parsed?.data?.id ?? parsed?.id ?? userData?.id;
      let token = parsed?.data?.token ?? parsed?.token ?? userData?.token ?? parsed?.jwt ?? parsed?.data?.jwt ?? parsed?.access_token ?? parsed?.data?.access_token;
      // fallback attempts
      if (!token) {
        try {
          const raw = localStorage.getItem('fitbuddy_user_data');
          if (raw) {
            const p = JSON.parse(raw);
            token = p?.token ?? p?.jwt ?? p?.access_token;
          }
        } catch {}
      }

      if (!userId || userId === 'anon') {
        // No signed-in user: preserve anon chat and redirect to signin
        try { localStorage.setItem('fitbuddy_chat_anon', JSON.stringify(messages)); } catch {}
        const returnTo = encodeURIComponent(window.location.pathname || '/chat');
        window.location.href = `/signin?returnTo=${returnTo}`;
        return;
      }

      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch('/api/user/apply-action', { method: 'POST', headers, body: JSON.stringify({ id: userId, action: filtered }) });
      const j = await resp.json();
      if (!resp.ok) throw j;

      const { user } = j;
      const { saveUserData, saveWorkoutPlan, appendChatMessage } = await import('../services/localStorage');
      try { if (user && user.workoutPlan) saveWorkoutPlan(user.workoutPlan); } catch {}
      saveUserData(user, { skipBackup: false });
      window.dispatchEvent(new Event('fitbuddy-login'));

      // Append the assistant human-readable reply (from the AI reply text)
      const humanReply = humanReplyText || j.humanReply || j.applied || 'Buddy applied the changes.';
      setMessages(m => [...m, { role: 'assistant', text: humanReply }]);
      try { const uid = userData?.id || user?.id; appendChatMessage({ role: 'assistant', text: humanReply, ts: Date.now() }, { userId: uid }); } catch {}

      // Transform summary to simple past tense where possible
      const rawSummary = j.applied || actionJson.summary || 'Applied changes';
      let actionSummary = rawSummary;
      try {
        // e.g. "Set energy to 100" -> "Energy set to 100"
        const m = String(rawSummary).match(/^\s*Set\s+(\w+)\s+to\s+(.+)$/i);
        if (m) {
          const field = m[1];
          const val = m[2];
          actionSummary = `${field.charAt(0).toUpperCase() + field.slice(1)} set to ${val}`;
        } else {
          // fallback: prefix with past tense hint
          actionSummary = typeof rawSummary === 'string' ? rawSummary : JSON.stringify(rawSummary);
        }
      } catch {}

      setMessages(m => [...m, { role: 'action' as const, text: actionSummary }]);
      try { const uid = userData?.id || user?.id; appendChatMessage({ role: 'assistant', text: actionSummary, ts: Date.now() }, { userId: uid }); } catch {}

    } catch (err) {
      console.error('Failed to apply action on server:', err);
      setMessages(m => [...m, { role: 'assistant', text: 'Failed to apply changes on the server.' }]);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    const newUserMsg = { role: 'user' as const, text };
    setMessages(m => [...m, newUserMsg]);
    setInput('');
    setLoading(true);
    // Persist the message into the unified chat history so backups include it
    try {
      const { appendChatMessage } = await import('../services/localStorage');
      const uid = userData?.id;
      appendChatMessage({ role: 'user', text, ts: Date.now() }, { userId: uid });
    } catch (e) { /* ignore */ }

  // Build prompt including a short user-data summary and recent conversation
  const conversation = messages.concat(newUserMsg).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
  const planSnippet = userData?.workoutPlan ? `\nUser workoutPlan: ${JSON.stringify(userData.workoutPlan).slice(0,800)}` : '';
  const basePrompt = `You are FitBuddy's AI assistant named Buddy. Use the following user profile to personalize answers: ${summarizeUser(userData)}\n\nConversation:\n${conversation}\n\nRespond fully and directly to the user's last message. Keep answers actionable and concise.`;
  const examplesLines = [
    '',
    'Examples (MUST follow the JSON format exactly, but feel free to chnage the data and values):',
    '',
    '1) Simple numeric set (set energy to 10)',
    'Human reply:',
    "I've increased your energy to help with today's workout.",
    '',
    'JSON block:',
    '```json',
    '{',
    '  "__action": true,',
    '  "updates": [',
    '    { "op": "set", "path": "energy", "value": 10 }',
    '  ],',
    '  "summary": "Set energy to 10"',
    '}',
    '```',
    '',
    '2) Change username',
    'Human reply:',
    'I can update your display name now.',
    '',
    'JSON block:',
    '```json',
    '{',
    '  "__action": true,',
    '  "updates": [',
    '    { "op": "set", "path": "username", "value": "fit_william" }',
    '  ],',
    '  "summary": "Change username to fit_william"',
    '}',
    '```',
    '',
    '3) Add an item to inventory (push)',
    'Human reply:',
    "I'll add the SuperBand to your inventory for resistance training.",
    '',
    'JSON block:',
    '```json',
    '{',
    '  "__action": true,',
    '  "updates": [',
    '    {',
    '      "op": "push",',
    '      "path": "inventory",',
    '      "value": {',
    '        "id": "superband-01",',
    '        "name": "SuperBand",',
    '        "type": "equipment",',
    '        "acquiredAt": "2025-09-05"',
    '      }',
    '    }',
    '  ],',
    '  "summary": "Add SuperBand to inventory"',
    '}',
    '```',
    '',
  '4) Replace the full workout plan (ONLY if user explicitly requests a full replacement)',
  'Human reply:',
  "You asked to replace your entire workout plan. I will prepare a complete plan object — please confirm before applying.",
  '',
  'JSON block (skeleton example):',
  '```json',
  '{',
  '  "__action": true,',
  '  "updates": [',
  '    {',
  '      "op": "set",',
  '      "path": "workoutPlan",',
  '      "value": { "id": "<id>", "name": "<name>", "startDate": "<YYYY-MM-DD>", "endDate": "<YYYY-MM-DD>", "dailyWorkouts": [ /* day objects */ ] }',
  '    }',
  '  ],',
  '  "summary": "Replace entire workoutPlan (user-requested full replacement)"',
  '}',
  '```',
  '',
  'Instruction: DO NOT create or emit a full workoutPlan unless the user explicitly asks for a full replacement. Prefer patch-style single-day or small updates. If the user asks for a full plan, emit a compact skeleton like above and ask for confirmation before applying.' ,
    '',
    '5) Multiple updates in one action:',
    'Human reply:',
    "I'll apply the three updates you requested: raise energy, add equipment, and update your display name.",
    '',
    'JSON block:',
    '```json',
    '{',
    '  "__action": true,',
    '  "updates": [',
    '    { "op": "set", "path": "energy", "value": 8 },',
    '    {',
    '      "op": "push",',
    '      "path": "inventory",',
    '      "value": { "id": "resmat-02", "name": "Travel Mat", "type": "equipment", "acquiredAt": "2025-09-05" }',
    '    },',
    '    { "op": "set", "path": "username", "value": "will_fit" }',
    '  ],',
    '  "summary": "Set energy to 8, add Travel Mat to inventory, change username to will_fit"',
    '}',
    '```',
    '',
    '6) When no changes are intended:',
    'Human reply only (no JSON block):',
    "No changes are needed — here's a suggestion: try adding a 10-minute mobility warmup before your workouts this week.",
    '',
    '(Must NOT include a JSON block in this case.)',
    '',
    'Short checklist to follow exactly:',
    '- Always emit human reply first.',
    '- If proposing changes emit exactly one fenced JSON block with the object keys: "__action", "updates", "summary".',
    '- Use "set" to replace values and "push" to append to arrays.',
    '- For "workoutPlan" send the full new object as the value for a "set".',
    '- No additional text inside or around the fenced JSON block.',
    '',
    'NEW EXAMPLES (Modify single days)',
    '',
    "7) Modify a single day's workouts (preferred when only one day needs adjustment)",
    'Human reply:',
    "I'll update day 3's workouts to an active recovery set — keeping the rest of your plan intact.",
    '',
    'JSON block:',
    '```json',
    '{',
    '  "__action": true,',
    '  "updates": [',
    '    { "op": "set", "path": "workoutPlan/dailyWorkouts/2/workouts", "value": [ { "name": "Foam Rolling", "description": "Release muscle tension.", "difficulty": "beginner", "duration": "15 minutes", "reps": "1x15", "muscleGroups": ["full body"], "equipment": ["Foam roller"] } ] }',
    '  ],',
    '  "summary": "Set Day 3 to active recovery workouts"',
    '}',
    '```',
    '',
    "8) Modify a single day's metadata (type or totalTime)",
    'Human reply:',
    "I'll change day 3's type to 'activeRecovery' and adjust totalTime to '30 minutes'.",
    '',
    'JSON block:',
    '```json',
    '{',
    '  "__action": true,',
    '  "updates": [',
    '    { "op": "set", "path": "workoutPlan/dailyWorkouts/2/type", "value": "activeRecovery" },',
    '    { "op": "set", "path": "workoutPlan/dailyWorkouts/2/totalTime", "value": "30 minutes" }',
    '  ],',
    '  "summary": "Update Day 3 type and totalTime"',
    '}',
    '```',
    '',
    "9) Recommended example day (use as template for modifications)",
    'Human reply:',
    "Here's a recommended example day — when updating a day, keep the same object shape:",
    '',
    'Example day JSON:',
    '```json',
    '{',
    '    "date": "2025-09-10",',
    '    "type": "Full Body",',
    '    "completed": false,',
    '    "totalTime": "30 minutes",',
    '    "workouts": [',
    '        {',
    '            "name": "Lunges",',
    '            "description": "",',
    '            "difficulty": "beginner",',
    '            "duration": "10 minutes",',
    '            "reps": "3x10 each leg",',
    '            "muscleGroups": ["quads","glutes","hamstrings"],',
    '            "equipment": []',
    '        },',
    '        {',
    '            "name": "Plank",',
    '            "description": "",',
    '            "difficulty": "beginner",',
    '            "duration": "10 minutes",',
    '            "reps": "3x30 seconds",',
    '            "muscleGroups": ["core"],',
    '            "equipment": []',
    '        },',
    '        {',
    '            "name": "Overhead Press (Dumbbell)",',
    '            "description": "",',
    '            "difficulty": "beginner",',
    '            "duration": "10 minutes",',
    '            "reps": "3x10",',
    '            "muscleGroups": ["shoulders"],',
    '            "equipment": ["dumbbell"]',
    '        }',
    '    ],',
    '    "alternativeWorkouts": []',
    '}',
    '```',
    '',
    'Instruction: When modifying days, prefer the patch-style single-day updates above rather than replacing the whole `workoutPlan` unless the user explicitly asks for a full replacement.',
  ];
  const examples = examplesLines.join('\n');
  const prompt = basePrompt + planSnippet + `\n\nWhen you propose changes to the user's profile or workout plan, produce both: (1) a human-readable reply, and (2) a JSON action block fenced as \`\`\`json containing {"__action":true, "updates":[...], "summary":"..."}. Only include the JSON block when you intend the site to apply changes. Close the JSON block with \`\`\`.` + examples;

    try {
  // Read localStorage keys and provide full context (truncated by service)
  const questionnaireRaw = localStorage.getItem('fitbuddy_questionnaire_progress');
  const userRaw = localStorage.getItem('fitbuddy_user_data');
  const planRaw = localStorage.getItem('fitbuddy_workout_plan');
  let questionnaire = null;
  let localUser = null;
  let localPlan = null;
  try { questionnaire = questionnaireRaw ? JSON.parse(questionnaireRaw) : null; } catch { questionnaire = questionnaireRaw; }
  try { localUser = userRaw ? JSON.parse(userRaw) : null; } catch { localUser = userRaw; }
  try { localPlan = planRaw ? JSON.parse(planRaw) : null; } catch { localPlan = planRaw; }

  const res = await getAITextResponse({ prompt, localStorageContext: { questionnaire, userData: localUser, workoutPlan: localPlan } });
      let reply = res.text || '';
      // Try to extract action JSON and remove it from the assistant reply
      let actionJson: any = null;
      try {
        // Prefer fenced ```json blocks first
        let source: string | null = null;
        const fencedJson = reply.match(/```json([\s\S]*?)```/i);
        if (fencedJson && fencedJson[1]) {
          source = fencedJson[1].trim();
        } else {
          // fallback: any fenced block
          const fencedAny = reply.match(/```([\s\S]*?)```/i);
          if (fencedAny && fencedAny[1]) source = fencedAny[1].trim();
        }
        // Last-resort: find the last {...} block in the reply or raw response
        if (!source) {
          const allBraces = Array.from((reply.match(/\{[\s\S]*?\}/g) || []) );
          if (allBraces.length) source = allBraces[allBraces.length - 1];
          else if (res.raw) {
            const rawMatches = Array.from((String(res.raw).match(/\{[\s\S]*?\}/g) || []));
            if (rawMatches.length) source = rawMatches[rawMatches.length - 1];
          }
        }
        if (source) {
          // Try to parse JSON. If the fenced block contained markdown fences, strip them
          const cleaned = source.replace(/^```json\s*/i, '').replace(/\s*```$/,'');
          actionJson = JSON.parse(cleaned);
          // remove the JSON block from the reply text (if present)
          reply = reply.replace(source, '').replace(/```json[\s\S]*?```/i, '').trim();
        } else {
          // Fallback: try to find an inline JSON object containing "__action" and extract balanced braces
          try {
            const marker = '"__action"';
            const mi = reply.indexOf(marker);
            if (mi !== -1) {
              // find the opening brace before the marker
              const before = reply.lastIndexOf('{', mi);
              if (before !== -1) {
                // walk forward to find the matching closing brace
                let depth = 0;
                let end = -1;
                for (let i = before; i < reply.length; i++) {
                  const ch = reply[i];
                  if (ch === '{') depth++;
                  else if (ch === '}') {
                    depth--;
                    if (depth === 0) { end = i; break; }
                  }
                }
                if (end !== -1) {
                  const candidate = reply.slice(before, end + 1);
                  try {
                    actionJson = JSON.parse(candidate);
                    // strip the candidate JSON from the reply
                    reply = (reply.slice(0, before) + reply.slice(end + 1)).trim();
                  } catch (e) {
                    // ignore parse error
                  }
                }
              }
            }
          } catch (e) {
            // ignore fallback errors
          }
        }
      } catch (e) {
        actionJson = null;
      }

      // Sanitize reply to remove any visible action JSON
      const cleanedReply = removeActionJsonFromText(reply);
      // If there is an actionable JSON, apply it automatically (append assistant human reply + action summary).
      if (actionJson && actionJson.__action && Array.isArray(actionJson.updates)) {
        // applyAction will append the assistant human reply (we pass cleanedReply) and the past-tense action summary and persist both
        await applyAction(actionJson, cleanedReply);
      } else {
        // Normal assistant reply: display and persist
        setMessages(m => [...m, { role: 'assistant', text: cleanedReply }]);
        try {
          const { appendChatMessage } = await import('../services/localStorage');
          const uid = userData?.id;
          appendChatMessage({ role: 'assistant', text: cleanedReply, ts: Date.now() }, { userId: uid });
        } catch (e) { /* ignore */ }
      }
      
    } catch (e) {
      console.error('Gemini chat error', e);
      setMessages(m => [...m, { role: 'assistant', text: 'Buddy is currently unavailable. Please try again later.' }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="gemini-page-root">
      <div className="gemini-page">
      <div className="gemini-container">
        <header className="gemini-header">
          <h1>Chat with Buddy</h1>
          <p className="gemini-sub">Ask Buddy about your workouts, plan, or goals — Buddy knows your profile.</p>
        </header>

        <div className="gemini-chat" ref={listRef} role="log" aria-live="polite">
          {messages.map((m, i) => {
            const isAssistant = m.role === 'assistant';
            const isUser = m.role === 'user';
            const isSingleLine = (isAssistant || isUser) && typeof m.text === 'string' && m.text.indexOf('\n') === -1;
            const classes = ['msg', isAssistant ? 'msg-assistant' : m.role === 'user' ? 'msg-user' : 'msg-action'];
            if (isSingleLine) classes.push('single-line');
            return (
              <div key={i} className={classes.join(' ')}>
                {isAssistant && (
                  <div className="logo" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-dumbbell"><path d="m6.5 6.5 11 11"></path><path d="m21 21-1-1"></path><path d="m3 3 1 1"></path><path d="m18 22 4-4"></path><path d="m2 6 4-4"></path><path d="m3 10 7-7"></path><path d="m14 21 7-7"></path></svg>
                  </div>
                )}
                {m.role === 'user' && (
                  <div className="logo user-logo" aria-hidden>
                    {userData?.avatar || userData?.avatarUrl ? (
                      <img src={userData?.avatar || userData?.avatarUrl} alt={userData?.username || 'User'} />
                    ) : (
                      <span className="initials">{(userData?.username || 'U').toString().trim().substring(0,2).toUpperCase()}</span>
                    )}
                  </div>
                )}
                <div className="msg-text">{m.text}</div>
              </div>
            );
          })}
          {loading && (
            <div className="msg msg-assistant loading">
              <div className="logo" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-dumbbell"><path d="m6.5 6.5 11 11"></path><path d="m21 21-1-1"></path><path d="m3 3 1 1"></path><path d="m18 22 4-4"></path><path d="m2 6 4-4"></path><path d="m3 10 7-7"></path><path d="m14 21 7-7"></path></svg>
              </div>
              <div className="msg-text">Buddy is typing...</div>
            </div>
          )}
        </div>

        <div className="gemini-input">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask Buddy about your plan or goals..."
            aria-label="Ask Gemini"
          />
          <button className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()} aria-label="Send message">Send</button>
        </div>
        </div>
      </div>

      {/* ActionConfirmModal removed - actions are applied automatically via applyAction */}
    </div>
  );
};

export default GeminiChatPage;
