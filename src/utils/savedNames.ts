const KEY = 'fitbuddya_saved_workouts';
const EVENT = 'fitbuddya-saved-names-updated';

export const loadSavedNames = (): string[] => {
  try {
    const raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || '[]';
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch (e) {
    console.warn('Failed to load saved workout names', e);
    return [];
  }
};

export const persistSavedNames = (list: string[]) => {
  const sanitized = Array.isArray(list) ? list.map(String) : [];
  try { localStorage.setItem(KEY, JSON.stringify(sanitized)); } catch {}
  try { sessionStorage.setItem(KEY, JSON.stringify(sanitized)); } catch {}
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: sanitized })); } catch {}
  return sanitized;
};

export const addSavedName = (name: string) => {
  if (!name) return loadSavedNames();
  const cur = loadSavedNames();
  if (cur.includes(name)) return cur;
  const next = [...cur, name];
  return persistSavedNames(next);
};

export const removeSavedName = (name: string) => {
  if (!name) return loadSavedNames();
  const cur = loadSavedNames();
  const next = cur.filter(n => n !== name);
  return persistSavedNames(next);
};

export const subscribeSavedNames = (cb: (list: string[]) => void) => {
  const handler = () => cb(loadSavedNames());
  const evHandler = (e: Event) => {
    const detail = (e as CustomEvent)?.detail;
    if (Array.isArray(detail)) cb(detail.map(String)); else handler();
  };
  window.addEventListener('storage', handler);
  window.addEventListener(EVENT, evHandler);
  return () => { window.removeEventListener('storage', handler); window.removeEventListener(EVENT, evHandler); };
};
