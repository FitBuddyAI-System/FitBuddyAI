import WelcomePage from './components/WelcomePage';
import Questionnaire from './components/Questionnaire';
import { useNavigate, Navigate } from 'react-router-dom';
import WorkoutCalendar from './components/WorkoutCalendar';
import AgreementGuard from './components/AgreementGuard';
import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';

import LoadingPage from './components/LoadingPage';
import ProfilePage from './components/ProfilePage';
import AchievementsPage from './components/AchievementsPage';

import SignInPage from './components/SignInPage';
import SignUpPage from './components/SignUpPage';
import EmailVerifyPage from './components/EmailVerifyPage';



import { WorkoutPlan, DayWorkout, Exercise } from './types';
import { loadUserData, loadWorkoutPlan, saveUserData, saveWorkoutPlan, clearUserData, getAuthToken, saveAuthToken } from './services/localStorage';
import { fetchUserById } from './services/authService';
import { format } from 'date-fns';
import { getPrimaryType, isWorkoutCompleteForStreak, resolveWorkoutTypes } from './utils/streakUtils';
import { supabase } from './services/supabaseClient';


import NotFoundPage from './components/NotFoundPage';
import ShopPage from './components/ShopPage';
import GeminiChatPage from './components/GeminiChatPage';
import AdminPage from './components/AdminAuditPage';
import { useCloudBackup } from './hooks/useCloudBackup';
import RickrollPage from './components/RickrollPage';
import BlogPage from './components/BlogPage';
import BlogListPage from './components/BlogListPage';
import AgreementBanner from './components/AgreementBanner';
import TermsPage from './components/TermsPage';
import PrivacyPage from './components/PrivacyPage';
import HelpCenter from './components/HelpCenter';
import SettingsPage from './components/SettingsPage';
import WorkoutsPage from './components/WorkoutsPage';
import MyPlanPage from './components/MyPlanPage';
import PersonalLibraryPage from './components/PersonalLibraryPage';
import SuggestWorkout from './components/SuggestWorkout';
import { autoSaveWorkoutsFromAssessment } from './services/assessmentWorkouts';

function App() {
  const [userData, setUserData] = useState<any | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [planVersion, setPlanVersion] = useState(0);
  const navigate = useNavigate();
  const [profileVersion, setProfileVersion] = useState(0);
  const [isHydratingUser, setIsHydratingUser] = useState(true);
  const useSupabase = Boolean(import.meta.env.VITE_LOCAL_USE_SUPABASE || import.meta.env.VITE_SUPABASE_URL);
  // themeMode: 'auto' | 'light' | 'dark'
  const [themeMode, setThemeMode] = useState<'auto' | 'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'auto';
    // Prefer explicit saved mode, but fall back to legacy fitbuddy_theme value
    const savedMode = localStorage.getItem('fitbuddy_theme_mode');
    if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'auto') return savedMode as any;
    const legacy = localStorage.getItem('fitbuddy_theme');
    if (legacy === 'theme-dark') return 'dark';
    if (legacy === 'theme-light') return 'light';
    return 'auto';
  });

  // Cloud backup/restore integration
  useCloudBackup();

  useEffect(() => {
    if (!useSupabase) return;
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session) {
        // When Supabase client receives a session, send the refresh token
        // to the server for safe server-side storage and set an HttpOnly cookie.
        try {
          fetch('/api/auth?action=store_refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: session.user?.id, refresh_token: session.refresh_token })
          }).catch(() => {});
        } catch (e) {}
        if (session.access_token) {
          try { saveAuthToken(session.access_token); } catch {}
        }
      } else {
        try { fetch('/api/auth?action=clear_refresh', { method: 'POST' }).catch(() => {}); } catch {}
      }
    });
    return () => {
      try { authListener?.subscription?.unsubscribe(); } catch {}
    };
  }, [useSupabase]);
  // Apply effective theme to document based on themeMode and OS preference
  useEffect(() => {
    const applyEffective = (mode: 'auto' | 'light' | 'dark') => {
      let effective = 'theme-light';
      if (mode === 'auto') {
        try {
          const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
          if (mq && mq.matches) effective = 'theme-dark';
        } catch {}
      } else if (mode === 'dark') {
        effective = 'theme-dark';
      }
      const isDark = effective === 'theme-dark';
      document.documentElement.classList.toggle('theme-dark', isDark);
      document.body.classList.toggle('theme-dark', isDark);
      // keep legacy key for backward compatibility
      try { localStorage.setItem('fitbuddy_theme', effective); } catch {}
    };

    applyEffective(themeMode);

    // If auto mode, listen for OS preference changes
    let mq: MediaQueryList | null = null;
    const onChange = () => {
      if (themeMode !== 'auto') return;
      applyEffective('auto');
    };
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq && mq.addEventListener) mq.addEventListener('change', onChange as any);
      else if (mq && (mq as any).addListener) (mq as any).addListener(onChange);
    } catch {}
    return () => {
      try {
        if (mq && mq.removeEventListener) mq.removeEventListener('change', onChange as any);
        else if (mq && (mq as any).removeListener) (mq as any).removeListener(onChange);
      } catch {}
    };
  }, [themeMode]);

  // Apply persisted user theme when profile loads
  useEffect(() => {
    const storedTheme = (userData as any)?.data?.theme || (userData as any)?.theme;
    if (storedTheme) {
      if (storedTheme === 'theme-dark') setThemeMode('dark');
      else if (storedTheme === 'theme-light') setThemeMode('light');
    }
  }, [userData]);

  const setThemeModeHandler = (mode: 'auto' | 'light' | 'dark') => {
    setThemeMode(mode);
    try { localStorage.setItem('fitbuddy_theme_mode', mode); } catch {}
    // If user explicitly selected light/dark, persist that preference to user profile
    if (mode === 'light' || mode === 'dark') {
      const themeStr = mode === 'dark' ? 'theme-dark' : 'theme-light';
      const current = userData as any;
      const normalizedUser: any = { ...(current?.data ?? current ?? {}), theme: themeStr };
      setUserData(normalizedUser);
      try {
        saveUserData({ data: normalizedUser }, { skipBackup: false });
      } catch (e) {
        console.warn('Failed to persist theme to user profile:', e);
      }
    }
  };

  const toggleTheme = () => {
    // convenience: toggle between light and dark explicit modes
    setThemeModeHandler(themeMode === 'dark' ? 'light' : 'dark');
  };

  // Poll user from server periodically if logged in. Throttle to reduce load and
  // avoid polling when the page is hidden (background tab).
  useEffect(() => {
    if (!userData?.id) return;
    let stopped = false;
    const fetchAndUpdate = async () => {
      if (stopped) return;
      // Don't poll while page is hidden to avoid unnecessary background traffic
      if (typeof document !== 'undefined' && document.hidden) return;
      const fresh = await fetchUserById(userData.id);
      if (fresh) setUserData(fresh);
    };
    // Run an initial check quickly, then throttle to a longer interval
    fetchAndUpdate();
    const interval = setInterval(fetchAndUpdate, 15000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [userData?.id]);

  // Listen for logout event to clear userData and stop polling
  useEffect(() => {
    const handleLogout = () => setUserData(null);
    window.addEventListener('fitbuddyai-logout', handleLogout);
    return () => window.removeEventListener('fitbuddyai-logout', handleLogout);
  }, []);

  // Listen for login event (dispatched after sign-in/restore) and sync saved data into state
  useEffect(() => {
    const handleLogin = () => {
      const savedUserData = loadUserData();
      const savedWorkoutPlan = loadWorkoutPlan();
      if (savedUserData) setUserData(savedUserData);
  if (savedWorkoutPlan) { setWorkoutPlan(savedWorkoutPlan); setPlanVersion(v => v + 1); }
    };
    window.addEventListener('fitbuddyai-login', handleLogin);
    // Listen for direct user updates (e.g., streak changes) from other components
    const handleUserUpdated = (e: any) => {
      try {
        const payload = e?.detail;
        if (!payload) return;
        setUserData(payload);
        setProfileVersion(v => v + 1);
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener('fitbuddyai-user-updated', handleUserUpdated as EventListener);
    return () => {
      window.removeEventListener('fitbuddyai-login', handleLogin);
      window.removeEventListener('fitbuddyai-user-updated', handleUserUpdated as EventListener);
    };
  }, []);

  // Listen for localStorage changes to fitbuddyai_user_data and update userData state
  // Use no external dependencies to avoid re-registering the listeners on every
  // userData change which can cause update loops. Use a functional state
  // update and a shallow/deep compare to avoid unnecessary setState calls.
  useEffect(() => {
    const syncUser = () => {
      try {
        const updated = loadUserData();
        if (!updated) return;
        setUserData((prev: any | null) => {
          // Only update when the stored user either belongs to the same id
          // or there is no previous user, and when the objects differ.
          try {
            if (!prev || updated.id === prev.id) {
              const prevJson = JSON.stringify(prev || {});
              const updJson = JSON.stringify(updated || {});
              if (prevJson !== updJson) return updated;
            }
          } catch (e) {
            // If stringify fails for any reason, fall back to assigning when id matches
            if (!prev || updated.id === prev.id) return updated;
          }
          return prev;
        });
      } catch (e) {
        // ignore
      }
    };

    // Listen for legacy storage events (keeps backward compat) and BroadcastChannel messages
    window.addEventListener('storage', syncUser);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('fitbuddyai');
      bc.onmessage = () => syncUser();
    } catch (e) {
      // ignore if not available
    }
    return () => {
      window.removeEventListener('storage', syncUser);
      try { if (bc) { bc.close(); } } catch (e) {}
    };
  }, []);


  // Load saved data on startup and always fetch user from server if logged in
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (useSupabase) {
        try {
          // Attempt to refresh the access token via server-side stored refresh token.
          const resp = await fetch('/api/auth?action=refresh', { method: 'POST' });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.access_token) {
                try { saveAuthToken(data.access_token); } catch {}
                // Set a session on the Supabase client so client-side SDK calls
                // work until the server refreshes again. Include `refresh_token`
                // only when the server returned one; the Supabase client also
                // accepts being seeded with just an `access_token` when a
                // refresh token isn't available.
                if (data.refresh_token) {
                  try {
                    await supabase.auth.setSession({
                      access_token: data.access_token,
                      refresh_token: data.refresh_token,
                    });
                  } catch (e) {
                    // Swallow Supabase client errors here; app can still rely on
                    // the stored access token for server-side operations.
                  }
                }
            }
          }
        } catch (err) {
          console.warn('[App] Supabase server-side refresh failed', err);
        }
      }
      const savedUserData = loadUserData();
      const savedWorkoutPlan = loadWorkoutPlan();
      console.log('App startup - loadUserData ->', savedUserData);
      console.log('App startup - loadWorkoutPlan ->', savedWorkoutPlan);
      if (!cancelled && savedUserData) {
        setUserData(savedUserData);
        if (savedUserData.id) {
          try {
            const freshUser = await fetchUserById(savedUserData.id);
            if (!cancelled && freshUser) setUserData(freshUser);
          } catch (e) {
            // ignore fetch failure, keep saved data
          }
        }
      }
      if (!cancelled && savedWorkoutPlan) {
        setWorkoutPlan(savedWorkoutPlan);
        setPlanVersion(v => v + 1);
      }
      if (!cancelled) setIsHydratingUser(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Save data when it changes, but do not save if userData is null (prevents refresh after logout)
  useEffect(() => {
    // Avoid clearing persisted session while we are still hydrating from storage
    if (isHydratingUser) return;
    if (userData) {
      // Save local userData without triggering the cloud backup scheduler.
      // Cloud backups for chat are triggered explicitly from appendChatMessage to avoid
      // frequent empty saves while the app polls for user updates.
      saveUserData(userData, { skipBackup: true });
    } else {
      // If userData is null, clear user data from storage
      // (defensive, in case logout event missed)
      clearUserData();
    }
  }, [userData, isHydratingUser]);

  useEffect(() => {
    if (workoutPlan) {
      saveWorkoutPlan(workoutPlan);
    }
  }, [workoutPlan]);

  // Instrumentation: log workoutPlan updates for debugging regenerate flow
  useEffect(() => {
    console.log('App: workoutPlan updated (version:', planVersion, '):', workoutPlan);
  }, [workoutPlan, planVersion]);
  const handleShopPurchase = (item: any) => {
    // Deduct energy and add item to user inventory (simplified)
    setUserData((prev: any) => {
      if (!prev) return prev;
      const newEnergy = (prev.energy || 0) - item.price;
      const inventory = Array.isArray(prev.inventory) ? prev.inventory : [];
      return { ...prev, energy: newEnergy, inventory: [...inventory, item] };
    });
    // Optionally: show a toast or animation
  };

  const handleRedeemStreakSaver = (): string | null => {
    if (!userData) return 'Sign in to redeem streak savers.';
    const inventory = Array.isArray(userData.inventory) ? [...userData.inventory] : [];
    const saverIndex = inventory.findIndex((entry) => String(entry?.id || '').startsWith('streak-saver'));
    if (saverIndex < 0) return 'You do not own any streak savers.';
    const saverEntry = inventory[saverIndex];
    const availableQty = Number(saverEntry?.quantity ?? saverEntry?.count ?? 0);
    if (availableQty <= 0) return 'No streak savers are ready to redeem.';
    if (!workoutPlan) return 'Create or load a workout plan before redeeming a streak saver.';

    const parseCalendarDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, (month || 1) - 1, day || 1);
    };

    const completedEntries = workoutPlan.dailyWorkouts
      .map((workout) => ({ workout, date: parseCalendarDate(workout.date) }))
      .filter(({ workout }) => isWorkoutCompleteForStreak(workout))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    if (completedEntries.length < 2) {
      return 'You need at least two completed streaks before a saver can bridge them.';
    }

    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    type GapInfo = {
      missingDates: Date[];
      gapReferenceWorkout: DayWorkout;
    };
    let gapInfo: GapInfo | null = null;
    for (let i = 0; i < completedEntries.length - 1; i += 1) {
      const later = completedEntries[i];
      const earlier = completedEntries[i + 1];
      const gapDays = Math.round((later.date.getTime() - earlier.date.getTime()) / MS_PER_DAY);
      if (gapDays >= 2) {
        const missingDates: Date[] = [];
        for (let delta = 1; delta < gapDays; delta += 1) {
          missingDates.push(new Date(earlier.date.getTime() + delta * MS_PER_DAY));
        }
        gapInfo = { missingDates, gapReferenceWorkout: later.workout };
        break;
      }
    }

    if (!gapInfo || gapInfo.missingDates.length === 0) {
      return 'No recent streak gaps are available to bridge.';
    }

    const { missingDates, gapReferenceWorkout } = gapInfo;
    const daysToBridge = missingDates.length;
    if (availableQty < daysToBridge) {
      const needed = daysToBridge - availableQty;
      return `You need ${daysToBridge} streak savers to bridge that gap. Buy ${needed} more to cover the skipped days.`;
    }

    if (daysToBridge > 1) {
      const firstLabel = format(missingDates[0], 'MMMM d');
      const lastLabel = format(missingDates[missingDates.length - 1], 'MMMM d');
      const confirmMessage = `You skipped ${daysToBridge} days (${firstLabel} - ${lastLabel}). Redeem ${daysToBridge} streak savers to cover them?`;
      const wantsMultiple = typeof window !== 'undefined' ? window.confirm(confirmMessage) : true;
      if (!wantsMultiple) {
        return `Each missed day needs a streak saver. Buy ${daysToBridge} more to keep your streak.`;
      }
    }

    const gapDateStrings = missingDates.map((date) => format(date, 'yyyy-MM-dd'));
    const fillType = gapReferenceWorkout ? getPrimaryType(gapReferenceWorkout) : 'strength';
    let normalizedTypes = gapReferenceWorkout ? resolveWorkoutTypes(gapReferenceWorkout) : [];
    if (normalizedTypes.length === 0) normalizedTypes = [fillType];
    const baseTypes = normalizedTypes.length ? normalizedTypes : [fillType];
    const isIceBridge = daysToBridge > 1;

    const cloneWorkouts = (list?: DayWorkout['workouts']) =>
      list?.map((entry) => ({ ...entry, muscleGroups: entry?.muscleGroups ? [...entry.muscleGroups] : [], equipment: entry?.equipment ? [...entry.equipment] : [] })) ?? [];
    const cloneAlternatives = (list?: DayWorkout['alternativeWorkouts']) =>
      list?.map((entry) => ({ ...entry, muscleGroups: entry?.muscleGroups ? [...entry.muscleGroups] : [], equipment: entry?.equipment ? [...entry.equipment] : [] })) ?? [];

    const placeholderWorkout: Exercise = {
      name: 'Streak Saver Boost',
      description: 'Bridged a missed day to keep your streak intact.',
      difficulty: 'intermediate',
      duration: '5 min',
      muscleGroups: [],
      equipment: []
    };

    const buildBridgeDay = (dateStr: string, existing?: DayWorkout): DayWorkout => {
      const workouts = cloneWorkouts(existing?.workouts);
      const alternativeWorkouts = cloneAlternatives(existing?.alternativeWorkouts);
      const typesForDay = baseTypes.length ? [...baseTypes] : [fillType];
      return {
        date: dateStr,
        workouts: workouts.length ? workouts : [{ ...placeholderWorkout }],
        alternativeWorkouts,
        completed: true,
        totalTime: existing?.totalTime || '5 min',
        type: typesForDay[0] || fillType,
        types: typesForDay,
        completedTypes: typesForDay,
        streakSaverBridge: isIceBridge
      };
    };

    const existingMap = new Map(workoutPlan.dailyWorkouts.map((day) => [day.date, day]));
    const filteredWorkouts = workoutPlan.dailyWorkouts.filter((day) => !gapDateStrings.includes(day.date));
    const updatedDailyWorkouts = [...filteredWorkouts];
    gapDateStrings.forEach((dateStr) => {
      updatedDailyWorkouts.push(buildBridgeDay(dateStr, existingMap.get(dateStr)));
    });
    const sortedDailyWorkouts = updatedDailyWorkouts.slice().sort((a, b) => a.date.localeCompare(b.date));
    const updatedPlan = { ...workoutPlan, dailyWorkouts: sortedDailyWorkouts };
    setWorkoutPlan(updatedPlan);
    setPlanVersion((v) => v + 1);

    const nextInventory = [...inventory];
    const remainingQty = availableQty - daysToBridge;
    if (remainingQty <= 0) {
      nextInventory.splice(saverIndex, 1);
    } else {
      nextInventory[saverIndex] = { ...saverEntry, quantity: remainingQty };
    }
    setUserData({ ...userData, inventory: nextInventory });

    return daysToBridge > 1
      ? `Redeemed ${daysToBridge} streak savers to bridge ${format(missingDates[0], 'MMMM d')} - ${format(missingDates[missingDates.length - 1], 'MMMM d')}.`
      : `Redeemed a streak saver to bridge ${format(missingDates[0], 'MMMM d')}.`;
  };

  // compute effective theme class for passing to components
  const effectiveThemeClass = ((): 'theme-light' | 'theme-dark' => {
    try {
      if (themeMode === 'auto') {
        const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
        return mq && mq.matches ? 'theme-dark' : 'theme-light';
      }
      return themeMode === 'dark' ? 'theme-dark' : 'theme-light';
    } catch {
      return 'theme-light';
    }
  })();

  return (
    <div className={`App ${effectiveThemeClass}`}>
      <Header userData={userData} profileVersion={profileVersion} theme={effectiveThemeClass} />
      <AgreementBanner userData={userData} />
      <main className="app-main">
        <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/workouts" element={<WorkoutsPage />} />
        <Route path="/library" element={<PersonalLibraryPage />} />
        <Route path="/profile" element={<ProfilePage userData={userData} onProfileUpdate={(user) => {
          try {
            const token = getAuthToken();
            // Persist updated user data and preserve session token
            if (token) saveUserData({ data: user, token });
            else saveUserData({ data: user });
          } catch (e) {
            // ignore persistence errors
          }
          setUserData(user);
          setProfileVersion(v => v + 1);
        }} profileVersion={profileVersion} />} />
        <Route path="/profile/achievements" element={<AchievementsPage />} />
        <Route path="/profile/settings" element={<SettingsPage theme={effectiveThemeClass} onToggleTheme={toggleTheme} />} />
        <Route path="/loading" element={<LoadingPage />} />
        <Route 
          path="/questionnaire" 
          element={
            userData?.id
              ? (
                <Questionnaire 
                  onComplete={(data, plan) => {
                    setUserData(data);
                    // use wrapper to ensure calendar re-renders when plan is set
                    setWorkoutPlan(plan);
                    setPlanVersion(v => v + 1);
                    const autoSaveResult = autoSaveWorkoutsFromAssessment(data);
                    if (autoSaveResult.added > 0) {
                      console.info(`[AI] Auto-saved ${autoSaveResult.added} workouts from assessment.`);
                    }
                    navigate('/calendar');
                  }} 
                />
              )
              : (isHydratingUser ? <LoadingPage /> : <Navigate to="/signin" replace />)
          } 
        />
        <Route 
          path="/calendar" 
          element={
            userData?.id
              ? (
                <AgreementGuard userData={userData}>
                  <WorkoutCalendar 
                    workoutPlan={workoutPlan}
                    userData={userData}
                    onUpdatePlan={(plan) => { setWorkoutPlan(plan); setPlanVersion(v => v + 1); }}
                  />
                </AgreementGuard>
              )
              : (
                isHydratingUser
                  ? <LoadingPage />
                  // If not signed in, still allow preview calendar (component handles guest fallback)
                  : <WorkoutCalendar 
                      workoutPlan={workoutPlan}
                      userData={userData}
                      onUpdatePlan={(plan) => { setWorkoutPlan(plan); setPlanVersion(v => v + 1); }}
                    />
              )
          } 
        />
        <Route 
          path="/shop"
          element={
            userData?.id
              ? <ShopPage user={userData || { energy: 0, inventory: [] }} onPurchase={handleShopPurchase} onRedeemStreakSaver={handleRedeemStreakSaver} />
              : (isHydratingUser ? <LoadingPage /> : <Navigate to="/signin" replace />)
          } 
        />
        <Route path="/my-plan" element={<MyPlanPage />} />
        <Route path="/blog" element={<BlogListPage />} />
        <Route path="/blog/:slug" element={<BlogPage />} />
  <Route path="/chat" element={<AgreementGuard userData={userData}><GeminiChatPage userData={userData} /></AgreementGuard>} />
  <Route path="/admin" element={<AdminPage />} />
  <Route path="/help" element={<HelpCenter />} />
  <Route path="/suggest-workout" element={<SuggestWorkout userData={userData} />} />
  <Route path="/terms" element={<TermsPage />} />
  <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
  <Route path="/verify-email" element={<EmailVerifyPage />} />
        <Route path="/rickroll" element={<RickrollPage />} />
        {/* 404 Not Found Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </main>
      {/* Site-wide footer ensures visibility on all routes and deployments */}
      <Footer themeMode={themeMode} onChangeThemeMode={setThemeModeHandler} />
    </div>
  );
}

export default App;
