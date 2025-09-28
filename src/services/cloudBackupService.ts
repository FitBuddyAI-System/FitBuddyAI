// src/services/cloudBackupService.ts
// Handles backup/restore of questionnaire progress and workout plan to server


export async function backupUserDataToServer(userId: string) {
  const fitbuddy_questionnaire_progress = localStorage.getItem('fitbuddy_questionnaire_progress');
  const fitbuddy_workout_plan = localStorage.getItem('fitbuddy_workout_plan');
  const fitbuddy_assessment_data = localStorage.getItem('fitbuddy_assessment_data');
  const fitbuddy_chat = localStorage.getItem(`fitbuddy_chat_${userId}`);
  const fitbuddy_user_data = localStorage.getItem('fitbuddy_user_data');
  if (!userId) return;
  try {
    // Only include keys that actually exist to avoid overwriting server data with nulls
  const payload: any = { userId };
  if (fitbuddy_questionnaire_progress != null) payload.fitbuddy_questionnaire_progress = fitbuddy_questionnaire_progress;
  if (fitbuddy_workout_plan != null) payload.fitbuddy_workout_plan = fitbuddy_workout_plan;
  if (fitbuddy_assessment_data != null) payload.fitbuddy_assessment_data = fitbuddy_assessment_data;
  // include chat history and user data if present so server can persist chat_history into payload
  if (fitbuddy_chat != null) payload.chat_history = fitbuddy_chat;
  if (fitbuddy_user_data != null) payload.fitbuddy_user_data = fitbuddy_user_data;

    // Attach local fitbuddy_user_data so server can cross-check client identity when needed
    try {
      const rawUser = localStorage.getItem('fitbuddy_user_data');
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
          // include raw parsed user object for server diagnostics
          payload.fitbuddy_user_data = parsed;
          // Also surface acceptance flags at top-level so the server can persist them into explicit columns
          if (parsed && typeof parsed === 'object') {
            if (parsed.accepted_terms !== undefined) payload.accepted_terms = parsed.accepted_terms;
            if (parsed.accepted_privacy !== undefined) payload.accepted_privacy = parsed.accepted_privacy;
            // If the per-user payload contains chat_history, ensure we include it too (unless already set from fitbuddy_chat)
            if (parsed.chat_history !== undefined && payload.chat_history === undefined) payload.chat_history = parsed.chat_history;
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
    const fitbuddy_questionnaire_progress = localStorage.getItem('fitbuddy_questionnaire_progress');
    const fitbuddy_workout_plan = localStorage.getItem('fitbuddy_workout_plan');
    const fitbuddy_assessment_data = localStorage.getItem('fitbuddy_assessment_data');
    const payload: any = { userId };
    if (fitbuddy_questionnaire_progress != null) payload.fitbuddy_questionnaire_progress = fitbuddy_questionnaire_progress;
    if (fitbuddy_workout_plan != null) payload.fitbuddy_workout_plan = fitbuddy_workout_plan;
    if (fitbuddy_assessment_data != null) payload.fitbuddy_assessment_data = fitbuddy_assessment_data;
    // Include acceptance flags if present in unified user_data
    try {
      const rawUser = localStorage.getItem('fitbuddy_user_data');
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
        localStorage.setItem(key, toStore);
      } catch (e) {
        // ignore per-call errors
      }
    };

  writeIfPresent('fitbuddy_questionnaire_progress');
  writeIfPresent('fitbuddy_workout_plan');
  writeIfPresent('fitbuddy_assessment_data');
  // Also handle chat history: write into per-user chat key if present
  try {
    const chat = payload.chat_history ?? payload.fitbuddy_chat ?? payload.fitbuddy_chat_history;
    if (chat !== undefined && chat !== null) {
      try {
        const toStore = typeof chat === 'string' ? chat : JSON.stringify(chat);
        localStorage.setItem(`fitbuddy_chat_${userId}`, toStore);
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
    const chatKey = `fitbuddy_chat_${userId}`;
    const fitbuddy_chat = localStorage.getItem(chatKey);
    // TOS store is a keyed object; include the whole object so server can store it
    const fitbuddy_tos = localStorage.getItem('fitbuddy_tos_accepted_v1');

    // Build minimal payload with these keys only to avoid shipping unrelated user data
    const payload: any = { userId };
    if (fitbuddy_chat != null) {
      try { payload.chat_history = JSON.parse(fitbuddy_chat); } catch { payload.chat_history = fitbuddy_chat; }
    }
    if (fitbuddy_tos != null) {
      try { payload.fitbuddy_tos_accepted_v1 = JSON.parse(fitbuddy_tos); } catch { payload.fitbuddy_tos_accepted_v1 = fitbuddy_tos; }
    }

    // If nothing to send, consider it successful (nothing to remove)
    if (payload.chat_history === undefined && payload.fitbuddy_tos_accepted_v1 === undefined) return true;

    const init = await import('./apiAuth').then(m => m.attachAuthHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
    const res = await fetch('/api/userdata/save', init);
    if (!res.ok) return false;

    // On success, remove the local sensitive keys
    try { localStorage.removeItem(chatKey); } catch {}
    try { localStorage.removeItem('fitbuddy_tos_accepted_v1'); } catch {}
    return true;
  } catch (e) {
    return false;
  }
}
