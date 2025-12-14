import React from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from '../services/authService';
import { clearUserData, clearQuestionnaireProgress, clearAuthToken, loadUserData } from '../services/localStorage';
import { backupUserDataToServer, backupAndDeleteSensitive } from '../services/cloudBackupService';
import './SignOutButton.css';

const SignOutButton: React.FC = () => {
  const navigate = useNavigate();
  const handleSignOut = async () => {
  // Mirror Header sign-out behavior: set cross-tab no-auto-restore
  try { localStorage.setItem('fitbuddyai_no_auto_restore', '1'); } catch {}
  try { sessionStorage.setItem('fitbuddyai_no_auto_restore', '1'); } catch {}

  const userId = (() => {
    try {
      const parsed = loadUserData();
      return parsed?.id || parsed?.sub || parsed?.data?.id || null;
    } catch (e) {
      return null;
    }
  })();

  if (userId) {
    try { await backupAndDeleteSensitive(String(userId)); } catch {}
    try { await backupUserDataToServer(String(userId)); } catch {}
  }

  // Immediately clear auth token and user data so no other listeners can re-persist them
  try { clearAuthToken(); } catch {}
  try { clearUserData(); } catch {}
  try { clearQuestionnaireProgress(); } catch {}
  // Also call legacy signOut to remove any auth cookies/local keys (non-blocking)
  try { signOut(); } catch {}

  // Notify app early to prevent other parts from re-saving user data
  try { window.dispatchEvent(new Event('fitbuddyai-logout')); } catch {}
  navigate('/signin');

  // Clear the 'no auto restore' guard after a short timeout so normal saves resume
  try {
    setTimeout(() => {
      try { sessionStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
      try { localStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
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
