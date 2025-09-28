import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom';

// Attach a global beforeunload handler to try to save user data when the tab is closed.
// We import the backup function lazily so this module doesn't increase bundle size unnecessarily.
const setupUnloadHandler = () => {
  try {
    let isAttached = false;
    const handler = async () => {
      try {
        // Attempt to backup user data if a userId is present in localStorage
        const raw = localStorage.getItem('fitbuddy_user_data');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const userId = parsed?.id || parsed?.sub || null;
        if (!userId) return;
        // Try sendBeacon first (synchronous and reliable for unload). If not available or it fails, fall back to async backup.
        try {
          const mod = await import('./services/cloudBackupService');
          const beaconOk = mod.beaconBackupUserData(String(userId));
          if (beaconOk) return;
        } catch (e) {}
        // Fallback (fire-and-forget) async backup
        try {
          const mod2 = await import('./services/cloudBackupService');
          mod2.backupUserDataToServer(String(userId));
        } catch (e) {}
      } catch (e) {}
    };
    if (!isAttached) {
      window.addEventListener('beforeunload', handler, { passive: true });
      // Also listen for our custom logout event so we can backup when the user clicks sign out
      window.addEventListener('fitbuddy-logout', async () => {
        try {
          const raw = localStorage.getItem('fitbuddy_user_data');
          if (!raw) return;
          const parsed = JSON.parse(raw);
          const userId = parsed?.id || parsed?.sub || null;
          if (!userId) return;
          const mod = await import('./services/cloudBackupService');
          // First try backing up and deleting sensitive keys (chat, TOS), then a full backup
          try { await mod.backupAndDeleteSensitive(String(userId)); } catch {}
          try { await mod.backupUserDataToServer(String(userId)); } catch {}
        } catch (e) {}
      });
      isAttached = true;
    }
  } catch (e) {}
};

setupUnloadHandler();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
