// Lightweight analytics helper: records verify page hits locally and optionally posts to a remote analytics URL
export function trackVerifyPageView(details: { email?: string }) {
  try {
    // Increment local counter
    const key = 'analytics_verify_page_views';
    const raw = localStorage.getItem(key);
    const count = raw ? Number(raw) || 0 : 0;
    localStorage.setItem(key, String(count + 1));
  } catch (e) {
    // ignore
  }

  // Optionally POST to a configured analytics endpoint
  try {
    const url = import.meta.env.VITE_ANALYTICS_URL;
    if (url) {
      navigator.sendBeacon && typeof navigator.sendBeacon === 'function'
        ? navigator.sendBeacon(url, JSON.stringify({ event: 'verify_page_view', email: details.email || null, ts: new Date().toISOString() }))
        : fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'verify_page_view', email: details.email || null, ts: new Date().toISOString() }) }).catch(() => {});
    }
  } catch (e) {
    // ignore
  }
}

export default { trackVerifyPageView };
