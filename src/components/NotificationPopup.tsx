import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './NotificationPopup.css';
import { Dumbbell } from 'lucide-react';

export type NotificationOptions = {
  id?: string;
  title?: string;
  message: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  durationMs?: number;
};

const EVENT = 'fitbuddy-notify-msg';

function Notification({ item, onClose }: { item: NotificationOptions; onClose: (id?: string) => void }) {
  const { title, message, variant = 'info' } = item;
  useEffect(() => {
    const t = setTimeout(() => onClose(item.id), item.durationMs || 4500);
    return () => clearTimeout(t);
  }, [item, onClose]);

  return (
    <div className={`fb-notice ${variant}`} role="status">
      <div className="fb-notice-icon">
        <Dumbbell size={20} />
      </div>
      <div className="fb-notice-body">
        {title ? <div className="fb-notice-title">{title}</div> : null}
        <div className="fb-notice-message">{message}</div>
      </div>
      <button aria-label="Dismiss" className="fb-notice-close" onClick={() => onClose(item.id)}>✕</button>
    </div>
  );
}

function NotificationManager() {
  const [items, setItems] = useState<NotificationOptions[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent)?.detail as NotificationOptions | undefined;
      if (!detail) return;
      const id = detail.id || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      setItems(prev => [{ ...detail, id }, ...prev].slice(0, 6));
    };
    window.addEventListener(EVENT, handler as EventListener);
    return () => window.removeEventListener(EVENT, handler as EventListener);
  }, []);

  const remove = (id?: string) => {
    if (!id) return;
    setItems(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="fb-notice-wrap" aria-live="polite">
      {items.map(it => (
        <Notification key={it.id} item={it} onClose={remove} />
      ))}
    </div>
  );
}

export function showFitBuddyNotification(opts: NotificationOptions) {
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: opts }));
  } catch (e) {
    // fallback: attach directly if dispatch fails
    (window as any).lastFitBuddyNotif = opts;
  }
}

// Mount the manager to the body so it exists on page load. Keep id stable so formatters won't add duplicates.
const ROOT_ID = 'fitbuddy-notice-root';
if (typeof window !== 'undefined' && !document.getElementById(ROOT_ID)) {
  try {
    const container = document.createElement('div');
    container.id = ROOT_ID;
    document.body.appendChild(container);
    createRoot(container).render(<NotificationManager />);
  } catch (e) {
    // ignore mount errors
  }
}

// Expose to console
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.showFitBuddyNotification = showFitBuddyNotification;

export default NotificationManager;
