// src/hooks/useCloudBackup.ts
// React hook to handle backup/restore of user data on sign in, sign out, and tab close
import { useEffect } from 'react';
import { backupUserDataToServer, restoreUserDataFromServer } from '../services/cloudBackupService';
import { getCurrentUser } from '../services/authService';
import { loadQuestionnaireProgress, loadWorkoutPlan } from '../services/localStorage';

export function useCloudBackup() {
  useEffect(() => {
    const user = getCurrentUser();
    // Skip auto-restore if sign-out recently occurred in this tab
    try {
      const noAuto = localStorage.getItem('fitbuddy_no_auto_restore') || sessionStorage.getItem('fitbuddy_no_auto_restore');
      if (noAuto) return;
    } catch {}

    // If local progress or a local workout plan already exists, skip server restore to avoid overwriting
    try {
      const existingProgress = loadQuestionnaireProgress();
      const existingPlan = loadWorkoutPlan();
      if (existingProgress || (existingPlan && existingPlan.dailyWorkouts && existingPlan.dailyWorkouts.length > 0)) {
        return;
      }
    } catch {}

    if (user?.id) {
      // Restore on mount (sign in or page load)
      restoreUserDataFromServer(user.id);
    }
    // Backup on sign out or tab close
    const handleBackup = () => {
      const user = getCurrentUser();
      if (user?.id) backupUserDataToServer(user.id);
    };
    window.addEventListener('beforeunload', handleBackup);
    return () => {
      handleBackup();
      window.removeEventListener('beforeunload', handleBackup);
    };
  }, []);
}
