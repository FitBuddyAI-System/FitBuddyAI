import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom';
// Notification popup (mounts a global manager and exposes `window.showFitBuddyNotification`)
import './components/NotificationPopup';

// Attach a global beforeunload handler to try to save user data when the tab is closed.
// We import the backup function lazily so this module doesn't increase bundle size unnecessarily.
const setupUnloadHandler = () => {
  try {
    let isAttached = false;
    const handler = async () => {
      try {
        // Attempt to backup user data if a userId is present in sessionStorage (we no longer persist user data in localStorage)
        let userId: string | null = null;
        try {
          const { loadUserData } = await import('./services/localStorage');
          const parsed = loadUserData();
          userId = parsed?.id || parsed?.sub || parsed?.data?.id || null;
          if (!userId) return;
        } catch { return; }
        // Try sendBeacon first (synchronous and reliable for unload). If not available or it fails, fall back to async backup.
        try {
          const mod = await import('./services/cloudBackupService');
          const beaconOk = await mod.beaconBackupUserData(String(userId));
          if (beaconOk) return;
        } catch {}
        // Fallback (fire-and-forget) async backup
        try {
          const mod2 = await import('./services/cloudBackupService');
          mod2.backupUserDataToServer(String(userId));
        } catch (e) {}
      } catch {}
    };
    if (!isAttached) {
      window.addEventListener('beforeunload', handler, { passive: true });
      // Also listen for our custom logout event so we can backup when the user clicks sign out
      window.addEventListener('fitbuddyai-logout', async () => {
          try {
            const { loadUserData } = await import('./services/localStorage');
            const parsed = loadUserData();
            const userId = parsed?.id || parsed?.sub || parsed?.data?.id || null;
            if (!userId) return;
            const mod = await import('./services/cloudBackupService');
            // First try backing up and deleting sensitive keys (chat, TOS), then a full backup
            try { await mod.backupAndDeleteSensitive(String(userId)); } catch {}
            try { await mod.backupUserDataToServer(String(userId)); } catch {}
          } catch {}
      });
      isAttached = true;
    }
  } catch {}
};

setupUnloadHandler();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
