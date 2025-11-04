// src/services/cloudBackupService.ts
// Handles backup/restore of questionnaire progress and workout plan to server


export async function backupUserDataToServer(userId: string) {
  const fitbuddyaiai_questionnaire_progress = localStorage.getItem('fitbuddyaiai_questionnaire_progress');
  const fitbuddyaiai_workout_plan = localStorage.getItem('fitbuddyaiai_workout_plan');
  const fitbuddyaiai_assessment_data = localStorage.getItem('fitbuddyaiai_assessment_data');
  const fitbuddyaiai_chat = sessionStorage.getItem(`fitbuddyaiai_chat_${userId}`) || localStorage.getItem(`fitbuddyaiai_chat_${userId}`);
  const fitbuddyaiai_user_data = sessionStorage.getItem('fitbuddyaiai_user_data') || localStorage.getItem('fitbuddyaiai_user_data');
  if (!userId) return;
  try {
    // Only include keys that actually exist to avoid overwriting server data with nulls
  const payload: any = { userId };
  if (fitbuddyaiai_questionnaire_progress != null) payload.fitbuddyaiai_questionnaire_progress = fitbuddyaiai_questionnaire_progress;
  if (fitbuddyaiai_workout_plan != null) payload.fitbuddyaiai_workout_plan = fitbuddyaiai_workout_plan;
  if (fitbuddyaiai_assessment_data != null) payload.fitbuddyaiai_assessment_data = fitbuddyaiai_assessment_data;
  // include chat history and user data if present so server can persist chat_history into payload
  if (fitbuddyaiai_chat != null) payload.chat_history = fitbuddyaiai_chat;
  if (fitbuddyaiai_user_data != null) payload.fitbuddyaiai_user_data = fitbuddyaiai_user_data;

    // Attach local fitbuddyaiai_user_data so server can cross-check client identity when needed
    try {
  const rawUser = sessionStorage.getItem('fitbuddyaiai_user_data') || localStorage.getItem('fitbuddyaiai_user_data');
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
          // include raw parsed user object for server diagnostics (avoid including tokens)
          if (parsed && typeof parsed === 'object') {
            const safe = { ...parsed };
            if (safe.token) delete safe.token;
            if (safe.jwt) delete safe.jwt;
            payload.fitbuddyaiai_user_data = safe;
            if (safe.accepted_terms !== undefined) payload.accepted_terms = safe.accepted_terms;
            if (safe.accepted_privacy !== undefined) payload.accepted_privacy = safe.accepted_privacy;
            if (safe.chat_history !== undefined && payload.chat_history === undefined) payload.chat_history = safe.chat_history;
          }
        } catch {}
      }
    } catch {}
  const init = await import('./apiAuth').then(m => m.attachAuthHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
  // Use the non-admin save endpoint for client-side backups
  await fetch('/api/userdata/save', init);
  } catch (err) {
    // Optionally log or handle error
  }
}

// Try to send a small payload via navigator.sendBeacon for unload scenarios.
export function beaconBackupUserData(userId: string) {
  try {
    if (!userId) return false;
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false;
    const fitbuddyaiai_questionnaire_progress = localStorage.getItem('fitbuddyaiai_questionnaire_progress');
    const fitbuddyaiai_workout_plan = localStorage.getItem('fitbuddyaiai_workout_plan');
    const fitbuddyaiai_assessment_data = localStorage.getItem('fitbuddyaiai_assessment_data');
    const payload: any = { userId };
    if (fitbuddyaiai_questionnaire_progress != null) payload.fitbuddyaiai_questionnaire_progress = fitbuddyaiai_questionnaire_progress;
    if (fitbuddyaiai_workout_plan != null) payload.fitbuddyaiai_workout_plan = fitbuddyaiai_workout_plan;
    if (fitbuddyaiai_assessment_data != null) payload.fitbuddyaiai_assessment_data = fitbuddyaiai_assessment_data;
    // Include acceptance flags if present in unified user_data
    try {
  const rawUser = sessionStorage.getItem('fitbuddyaiai_user_data') || localStorage.getItem('fitbuddyaiai_user_data');
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
          if (parsed && typeof parsed === 'object') {
            if (parsed.accepted_terms !== undefined) payload.accepted_terms = parsed.accepted_terms;
            if (parsed.accepted_privacy !== undefined) payload.accepted_privacy = parsed.accepted_privacy;
            if (parsed.chat_history !== undefined && payload.chat_history === undefined) payload.chat_history = parsed.chat_history;
          }
        } catch {}
      }
    } catch {}
    // Include a minimal auth token if present so server can associate without a long request; attachAuthHeaders isn't available here.
    // We send to the same endpoint; server will accept the POST but may not authenticate if missing headers.
    const url = '/api/userdata/save';
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    return navigator.sendBeacon(url, blob);
  } catch (e) {
    return false;
  }
}


export async function restoreUserDataFromServer(userId: string) {
  if (!userId) return;
  try {
    // Use POST /api/userdata/load for restores (new dedicated load endpoint)
    const postUrl = '/api/userdata/load';
    console.log('[cloudBackupService] restoreUserDataFromServer -> POSTing', postUrl, 'userId=', userId);
    const init = await import('./apiAuth').then(m => m.attachAuthHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }));
    const postRes = await fetch(postUrl, init);
    // Read as text so we can log snippets even when response isn't JSON
    const text = await postRes.text();
    console.log('[cloudBackupService] restoreUserDataFromServer -> response status:', postRes.status, 'ok:', postRes.ok);
    if (text && text.length > 0) console.log('[cloudBackupService] restoreUserDataFromServer -> response snippet:', text.slice(0, 1000));
    if (!postRes.ok) return;
    let raw: any = null;
    try {
      raw = text ? JSON.parse(text) : null;
    } catch (e) {
      console.warn('[cloudBackupService] restoreUserDataFromServer -> failed to parse JSON response:', e);
      return;
    }
    // Accept either { stored: { ... } } or { payload: { ... } } or direct payload
    const payload = raw?.stored ?? raw?.payload ?? raw;
    if (!payload) return;

    const writeIfPresent = (key: string) => {
      try {
        const v = payload[key];
        if (v === null || v === undefined) return;
        // Ensure we write a string to localStorage. Server may return parsed objects.
        const toStore = typeof v === 'string' ? v : JSON.stringify(v);
        // Persist restored keys into sessionStorage only for sensitive or user-scoped data.
        // We intentionally avoid writing restored user payload or chat to localStorage to prevent tokens/exposure.
        if (key === 'fitbuddyaiai_user_data') {
          try { sessionStorage.setItem(key, toStore); } catch {}
        } else {
          // Non-user long-term keys (questionnaire/workout/assessment) may remain in localStorage
          try { localStorage.setItem(key, toStore); } catch {}
        }
      } catch (e) {
        // ignore per-call errors
      }
    };

  writeIfPresent('fitbuddyaiai_questionnaire_progress');
  writeIfPresent('fitbuddyaiai_workout_plan');
  writeIfPresent('fitbuddyaiai_assessment_data');
  // Also handle chat history: write into per-user chat key if present
  try {
    const chat = payload.chat_history ?? payload.fitbuddyaiai_chat ?? payload.fitbuddyaiai_chat_history;
        if (chat !== undefined && chat !== null) {
      try {
        const toStore = typeof chat === 'string' ? chat : JSON.stringify(chat);
        try { sessionStorage.setItem(`fitbuddyaiai_chat_${userId}`, toStore); } catch { try { localStorage.setItem(`fitbuddyaiai_chat_${userId}`, toStore); } catch {} }
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {}
  console.log('[cloudBackupService] restoreUserDataFromServer -> wrote keys from payload:', Object.keys(payload));
  } catch (err) {
    // Optionally log or handle error
  }
}

// Backup then remove privacy-sensitive local keys (chat and TOS store).
// Returns true if the server accepted the backup and local keys were removed.
export async function backupAndDeleteSensitive(userId: string) {
  if (!userId) return false;
  try {
    const chatKey = `fitbuddyaiai_chat_${userId}`;
    const fitbuddyaiai_chat = localStorage.getItem(chatKey);
    // TOS store is a keyed object; include the whole object so server can store it
    const fitbuddyaiai_tos = localStorage.getItem('fitbuddyaiai_tos_accepted_v1');

    // Build minimal payload with these keys only to avoid shipping unrelated user data
    const payload: any = { userId };
    if (fitbuddyaiai_chat != null) {
      try { payload.chat_history = JSON.parse(fitbuddyaiai_chat); } catch { payload.chat_history = fitbuddyaiai_chat; }
    }
    if (fitbuddyaiai_tos != null) {
      try { payload.fitbuddyaiai_tos_accepted_v1 = JSON.parse(fitbuddyaiai_tos); } catch { payload.fitbuddyaiai_tos_accepted_v1 = fitbuddyaiai_tos; }
    }

    // If nothing to send, consider it successful (nothing to remove)
    if (payload.chat_history === undefined && payload.fitbuddyaiai_tos_accepted_v1 === undefined) return true;

    const init = await import('./apiAuth').then(m => m.attachAuthHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
    const res = await fetch('/api/userdata/save', init);
    if (!res.ok) return false;

    // On success, remove the local sensitive keys
    try { localStorage.removeItem(chatKey); } catch {}
    try { localStorage.removeItem('fitbuddyaiai_tos_accepted_v1'); } catch {}
    return true;
  } catch (e) {
    return false;
  }
}
