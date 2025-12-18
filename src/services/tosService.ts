// Clean tosService implementation - central localStorage-backed acceptance helpers
const STORAGE_KEY = 'fitbuddyai_tos_accepted_v1';

type AcceptRecord = {
  tos?: { acceptedAt: string } | true;
  privacy?: { acceptedAt: string } | true;
  acceptedAt?: string; // legacy
};

function readStore(): Record<string, AcceptRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function writeStore(data: Record<string, AcceptRecord>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* noop */ }
}

export function hasAcceptedTos(userId?: string | number | undefined) {
  try {
    const data = readStore();
    const key = userId ? String(userId) : '__anon__';
    const rec = data[key];
    const anon = data['__anon__'];
    if (rec) {
      if (rec.tos) return true;
      if (rec.acceptedAt) return true; // legacy
    }
    if (anon) {
      if (anon.tos) return true;
      if (anon.acceptedAt) return true;
    }
    return false;
  } catch (e) { return false; }
}

export function hasAcceptedPrivacy(userId?: string | number | undefined) {
  try {
    const data = readStore();
    const key = userId ? String(userId) : '__anon__';
    const rec = data[key];
    const anon = data['__anon__'];
    if (rec && rec.privacy) return true;
    if (anon && anon.privacy) return true;
    return false;
  } catch (e) { return false; }
}

export function hasAcceptedAll(userId?: string | number | undefined) {
  return hasAcceptedTos(userId) && hasAcceptedPrivacy(userId);
}

export function acceptTos(userId?: string | number | undefined) {
  try {
    const data = readStore();
    const key = userId ? String(userId) : '__anon__';
    const rec = data[key] || {};
    rec.tos = { acceptedAt: new Date().toISOString() };
    data[key] = rec;
    writeStore(data);
    try { window.dispatchEvent(new CustomEvent('fitbuddyai-tos-accepted', { detail: { userId: key } })); } catch (e) { }
    return true;
  } catch (e) { return false; }
}

export function acceptPrivacy(userId?: string | number | undefined) {
  try {
    const data = readStore();
    const key = userId ? String(userId) : '__anon__';
    const rec = data[key] || {};
    rec.privacy = { acceptedAt: new Date().toISOString() };
    data[key] = rec;
    writeStore(data);
    try { window.dispatchEvent(new CustomEvent('fitbuddyai-privacy-accepted', { detail: { userId: key } })); } catch (e) { }
    return true;
  } catch (e) { return false; }
}

export function migrateAnonToUser(userId?: string | number | undefined) {
  try {
    if (!userId) return false;
    const data = readStore();
    const anon = data['__anon__'];
    if (!anon) return false;
    const key = String(userId);
    const rec = data[key] || {};
    let changed = false;
    if (anon.tos && !rec.tos) { rec.tos = anon.tos; changed = true; }
    if (anon.privacy && !rec.privacy) { rec.privacy = anon.privacy; changed = true; }
    if (changed) {
      data[key] = rec;
      delete data['__anon__'];
      writeStore(data);
      if (rec.tos) try { window.dispatchEvent(new CustomEvent('fitbuddyai-tos-accepted', { detail: { userId: key } })); } catch {}
      if (rec.privacy) try { window.dispatchEvent(new CustomEvent('fitbuddyai-privacy-accepted', { detail: { userId: key } })); } catch {}
    }
    return changed;
  } catch { return false; }
}
