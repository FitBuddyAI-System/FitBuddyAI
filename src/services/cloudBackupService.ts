// src/services/cloudBackupService.ts
// Handles backup/restore of questionnaire progress and workout plan to server


export async function backupUserDataToServer(userId: string) {
  const fitbuddyai_questionnaire_progress = localStorage.getItem('fitbuddyai_questionnaire_progress');
  const fitbuddyai_workout_plan = localStorage.getItem('fitbuddyai_workout_plan');
  const fitbuddyai_assessment_data = localStorage.getItem('fitbuddyai_assessment_data');
  const fitbuddyai_chat = sessionStorage.getItem(`fitbuddyai_chat_${userId}`) || localStorage.getItem(`fitbuddyai_chat_${userId}`);
  const fitbuddyai_user_data = sessionStorage.getItem('fitbuddyai_user_data') || localStorage.getItem('fitbuddyai_user_data');
  if (!userId) return;
  try {
    // Only include keys that actually exist to avoid overwriting server data with nulls
  const payload: any = { userId };
  if (fitbuddyai_questionnaire_progress != null) payload.fitbuddyai_questionnaire_progress = fitbuddyai_questionnaire_progress;
  if (fitbuddyai_workout_plan != null) payload.fitbuddyai_workout_plan = fitbuddyai_workout_plan;
  if (fitbuddyai_assessment_data != null) payload.fitbuddyai_assessment_data = fitbuddyai_assessment_data;
  // include chat history and user data if present so server can persist chat_history into payload
  if (fitbuddyai_chat != null) payload.chat_history = fitbuddyai_chat;
  if (fitbuddyai_user_data != null) payload.fitbuddyai_user_data = fitbuddyai_user_data;

    // Attach local fitbuddyai_user_data so server can cross-check client identity when needed
    try {
  const rawUser = sessionStorage.getItem('fitbuddyai_user_data') || localStorage.getItem('fitbuddyai_user_data');
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
          // include raw parsed user object for server diagnostics (avoid including tokens)
          if (parsed && typeof parsed === 'object') {
            const safe = { ...parsed };
            if (safe.token) delete safe.token;
            if (safe.jwt) delete safe.jwt;
            payload.fitbuddyai_user_data = safe;
            if (safe.accepted_terms !== undefined) payload.accepted_terms = safe.accepted_terms;
            if (safe.accepted_privacy !== undefined) payload.accepted_privacy = safe.accepted_privacy;
            if (safe.chat_history !== undefined && payload.chat_history === undefined) payload.chat_history = safe.chat_history;
            // include streak if present on the stored user object or inside wrapper.data
            try {
              const possibleStreak = (safe && typeof safe === 'object') ? (safe.streak ?? (safe.data && safe.data.streak)) : undefined;
              if (typeof possibleStreak === 'number') payload.streak = possibleStreak;
              const possibleEnergy = (safe && typeof safe === 'object') ? (safe.energy ?? (safe.data && safe.data.energy)) : undefined;
              if (typeof possibleEnergy === 'number') payload.energy = possibleEnergy;
            } catch (e) {}
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
    const fitbuddyai_questionnaire_progress = localStorage.getItem('fitbuddyai_questionnaire_progress');
    const fitbuddyai_workout_plan = localStorage.getItem('fitbuddyai_workout_plan');
    const fitbuddyai_assessment_data = localStorage.getItem('fitbuddyai_assessment_data');
    const payload: any = { userId };
    if (fitbuddyai_questionnaire_progress != null) payload.fitbuddyai_questionnaire_progress = fitbuddyai_questionnaire_progress;
    if (fitbuddyai_workout_plan != null) payload.fitbuddyai_workout_plan = fitbuddyai_workout_plan;
    if (fitbuddyai_assessment_data != null) payload.fitbuddyai_assessment_data = fitbuddyai_assessment_data;
    // Include acceptance flags and streak if present in unified user_data
    try {
      const rawUser = sessionStorage.getItem('fitbuddyai_user_data') || localStorage.getItem('fitbuddyai_user_data');
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
            if (parsed && typeof parsed === 'object') {
              if (parsed.accepted_terms !== undefined) payload.accepted_terms = parsed.accepted_terms;
              if (parsed.accepted_privacy !== undefined) payload.accepted_privacy = parsed.accepted_privacy;
              if (parsed.chat_history !== undefined && payload.chat_history === undefined) payload.chat_history = parsed.chat_history;
              const possibleStreak = (parsed && typeof parsed === 'object') ? (parsed.streak ?? (parsed.data && parsed.data.streak)) : undefined;
              if (typeof possibleStreak === 'number') payload.streak = possibleStreak;
              const possibleEnergy = (parsed && typeof parsed === 'object') ? (parsed.energy ?? (parsed.data && parsed.data.energy)) : undefined;
              if (typeof possibleEnergy === 'number') payload.energy = possibleEnergy;
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
        if (key === 'fitbuddyai_user_data') {
          try { sessionStorage.setItem(key, toStore); } catch {}
        } else {
          // Non-user long-term keys (questionnaire/workout/assessment) may remain in localStorage
          try { localStorage.setItem(key, toStore); } catch {}
        }
      } catch (e) {
        // ignore per-call errors
      }
    };

  writeIfPresent('fitbuddyai_questionnaire_progress');
  writeIfPresent('fitbuddyai_workout_plan');
  writeIfPresent('fitbuddyai_assessment_data');
  // If username/avatar/energy were returned, merge them into the stored user profile
  try {
    const storedUserRaw = sessionStorage.getItem('fitbuddyai_user_data') || localStorage.getItem('fitbuddyai_user_data');
    const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
    const existing = storedUser?.data || storedUser || null;
    const nextUser = { ...(existing || {}), ...(payload.username ? { username: payload.username } : {}), ...(payload.avatar ? { avatar: payload.avatar } : {}), ...(payload.energy !== undefined ? { energy: payload.energy } : {}) };
    if (Object.keys(nextUser).length > 0) {
      const wrapper = storedUser && storedUser.timestamp ? { ...storedUser, data: nextUser } : { data: nextUser, timestamp: Date.now() };
      try { sessionStorage.setItem('fitbuddyai_user_data', JSON.stringify(wrapper)); } catch {}
      try { localStorage.setItem('fitbuddyai_user_data', JSON.stringify(wrapper)); } catch {}
    }
  } catch (e) {
    console.warn('restoreUserDataFromServer: failed to merge username/avatar/energy into local user_data', e);
  }
  // Also handle chat history: write into per-user chat key if present
  try {
    const chat = payload.chat_history ?? payload.fitbuddyai_chat ?? payload.fitbuddyai_chat_history;
        if (chat !== undefined && chat !== null) {
      try {
        const toStore = typeof chat === 'string' ? chat : JSON.stringify(chat);
        try { sessionStorage.setItem(`fitbuddyai_chat_${userId}`, toStore); } catch { try { localStorage.setItem(`fitbuddyai_chat_${userId}`, toStore); } catch {} }
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {}
    // If server returned a streak field, merge it into stored user payload and notify the app
    try {
      if (typeof payload.streak !== 'undefined') {
        try {
          const storedUserRaw = sessionStorage.getItem('fitbuddyai_user_data') || localStorage.getItem('fitbuddyai_user_data');
          const storedWrapper = storedUserRaw ? JSON.parse(storedUserRaw) : null;
          const existing = storedWrapper?.data || storedWrapper || {};
          const merged = { ...(existing || {}), streak: payload.streak };
          const wrapper = storedWrapper && storedWrapper.timestamp ? { ...storedWrapper, data: merged } : { data: merged, timestamp: Date.now() };
          try { sessionStorage.setItem('fitbuddyai_user_data', JSON.stringify(wrapper)); } catch {}
          try { localStorage.setItem('fitbuddyai_user_data', JSON.stringify(wrapper)); } catch {}
          try { window.dispatchEvent(new CustomEvent('fitbuddyai-user-updated', { detail: merged })); } catch {}
        } catch (e) {}
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
    const chatKey = `fitbuddyai_chat_${userId}`;
    const fitbuddyai_chat = localStorage.getItem(chatKey);
    // TOS store is a keyed object; include the whole object so server can store it
    const fitbuddyai_tos = localStorage.getItem('fitbuddyai_tos_accepted_v1');

    // Build minimal payload with these keys only to avoid shipping unrelated user data
    const payload: any = { userId };
    if (fitbuddyai_chat != null) {
      try { payload.chat_history = JSON.parse(fitbuddyai_chat); } catch { payload.chat_history = fitbuddyai_chat; }
    }
    if (fitbuddyai_tos != null) {
      try { payload.fitbuddyai_tos_accepted_v1 = JSON.parse(fitbuddyai_tos); } catch { payload.fitbuddyai_tos_accepted_v1 = fitbuddyai_tos; }
    }

    // If nothing to send, consider it successful (nothing to remove)
    if (payload.chat_history === undefined && payload.fitbuddyai_tos_accepted_v1 === undefined) return true;

    const init = await import('./apiAuth').then(m => m.attachAuthHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
    const res = await fetch('/api/userdata/save', init);
    if (!res.ok) return false;

    // On success, remove the local sensitive keys
    try { localStorage.removeItem(chatKey); } catch {}
    try { localStorage.removeItem('fitbuddyai_tos_accepted_v1'); } catch {}
    return true;
  } catch (e) {
    return false;
  }
}
