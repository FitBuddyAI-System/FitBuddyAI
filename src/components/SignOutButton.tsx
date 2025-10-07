import React from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from '../services/authService';
import { clearUserData, clearQuestionnaireProgress, clearWorkoutPlan, clearAuthToken } from '../services/localStorage';
import { backupUserDataToServer, backupAndDeleteSensitive } from '../services/cloudBackupService';
import './SignOutButton.css';

const SignOutButton: React.FC = () => {
  const navigate = useNavigate();
  const handleSignOut = () => {
  // Mirror Header sign-out behavior: set cross-tab no-auto-restore
  try { localStorage.setItem('fitbuddy_no_auto_restore', '1'); } catch {}
  try { sessionStorage.setItem('fitbuddy_no_auto_restore', '1'); } catch {}

  // Immediately clear auth token and user data so no other listeners can re-persist them
  try { clearAuthToken(); } catch {}
  try { clearUserData(); } catch {}
  try { clearQuestionnaireProgress(); } catch {}
  try { clearWorkoutPlan(); } catch {}
  // Also call legacy signOut to remove any auth cookies/local keys (non-blocking)
  try { signOut(); } catch {}

  // Notify app early to prevent other parts from re-saving user data
  try { window.dispatchEvent(new Event('fitbuddy-logout')); } catch {}
  navigate('/signin');

  // Fire-and-forget: attempt backups and sensitive deletion in background without touching storage
  (async () => {
    try {
      let userId: string | null = null;
      try { const { loadUserData } = await import('../services/localStorage'); const parsed = loadUserData(); userId = parsed?.id || parsed?.sub || parsed?.data?.id || null; } catch {}
      if (userId) {
        try { await backupAndDeleteSensitive(String(userId)); } catch {}
        try { await backupUserDataToServer(String(userId)); } catch {}
      }
    } catch (e) {}
  })();
  // Clear the 'no auto restore' guard after a short timeout so normal saves resume
  try {
    setTimeout(() => {
      try { sessionStorage.removeItem('fitbuddy_no_auto_restore'); } catch {}
      try { localStorage.removeItem('fitbuddy_no_auto_restore'); } catch {}
    }, 3000);
  } catch (e) {}
  };
  return (
    <button className="btn signout-btn" onClick={handleSignOut}>
      Sign Out
    </button>
  );
};

export default SignOutButton;
