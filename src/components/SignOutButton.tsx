import React from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from '../services/authService';
import { clearUserData, clearQuestionnaireProgress, clearWorkoutPlan } from '../services/localStorage';
import { backupUserDataToServer, backupAndDeleteSensitive } from '../services/cloudBackupService';
import './SignOutButton.css';

const SignOutButton: React.FC = () => {
  const navigate = useNavigate();
  const handleSignOut = () => {
  // Mirror Header sign-out behavior: set cross-tab no-auto-restore
  try { localStorage.setItem('fitbuddy_no_auto_restore', '1'); } catch {}
  try { sessionStorage.setItem('fitbuddy_no_auto_restore', '1'); } catch {}
  // Attempt to back up user data before clearing local storage. We await briefly but do not block indefinitely.
  (async () => {
    try {
      const raw = localStorage.getItem('fitbuddy_user_data');
      const parsed = raw ? JSON.parse(raw) : null;
      const userId = parsed?.id || parsed?.sub || null;
      if (userId) {
        // give the backup up to ~2 seconds to complete
        const p = (async () => {
          // Prefer backing up then deleting sensitive keys first
          try {
            await backupAndDeleteSensitive(String(userId));
          } catch {}
          return backupUserDataToServer(String(userId));
        })();
        const timeout = new Promise((res) => setTimeout(res, 2000));
        await Promise.race([p, timeout]);
      }
    } catch (e) {}
    // Clear stored user and related data using helpers
    try { clearUserData(); } catch {}
    try { clearQuestionnaireProgress(); } catch {}
    try { clearWorkoutPlan(); } catch {}
    // Also call legacy signOut to remove any auth cookies/local keys
    try { signOut(); } catch {}
    // Notify app and navigate to sign-in
    window.dispatchEvent(new Event('fitbuddy-logout'));
    navigate('/signin');
  })();
  };
  return (
    <button className="btn signout-btn" onClick={handleSignOut}>
      Sign Out
    </button>
  );
};

export default SignOutButton;
