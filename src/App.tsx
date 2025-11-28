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

import SignInPage from './components/SignInPage';
import SignUpPage from './components/SignUpPage';
import EmailVerifyPage from './components/EmailVerifyPage';



import { WorkoutPlan } from './types';
import { loadUserData, loadWorkoutPlan, saveUserData, saveWorkoutPlan, clearUserData } from './services/localStorage';
import { fetchUserById } from './services/authService';


import NotFoundPage from './components/NotFoundPage';
import ShopPage from './components/ShopPage';
import GeminiChatPage from './components/GeminiChatPage';
import AdminPage from './components/AdminAuditPage';
import { useCloudBackup } from './hooks/useCloudBackup';
import RickrollPage from './components/RickrollPage';
import AgreementBanner from './components/AgreementBanner';
import TermsPage from './components/TermsPage';
import PrivacyPage from './components/PrivacyPage';
import HelpCenter from './components/HelpCenter';
import SettingsPage from './components/SettingsPage';
import WorkoutsPage from './components/WorkoutsPage';
import MyPlanPage from './components/MyPlanPage';
import PersonalLibraryPage from './components/PersonalLibraryPage';

function App() {
  const [userData, setUserData] = useState<any | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [planVersion, setPlanVersion] = useState(0);
  const navigate = useNavigate();
  const [profileVersion, setProfileVersion] = useState(0);
  const [isHydratingUser, setIsHydratingUser] = useState(true);
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
      const merged: any = current ? { ...current } : { data: {} };
      merged.data = { ...(current?.data ?? current ?? {}), theme: themeStr };
      setUserData(merged);
      try {
        saveUserData(merged, { skipBackup: false });
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
    return () => window.removeEventListener('fitbuddyai-login', handleLogin);
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
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/workouts" element={<WorkoutsPage />} />
        <Route path="/library" element={<PersonalLibraryPage />} />
        <Route path="/profile" element={<ProfilePage userData={userData} onProfileUpdate={(user) => { setUserData(user); setProfileVersion(v => v + 1); }} profileVersion={profileVersion} />} />
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
                    key={planVersion}
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
                      key={planVersion}
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
              ? <ShopPage user={userData || { energy: 0, inventory: [] }} onPurchase={handleShopPurchase} />
              : (isHydratingUser ? <LoadingPage /> : <Navigate to="/signin" replace />)
          } 
        />
        <Route path="/my-plan" element={<MyPlanPage />} />
  <Route path="/chat" element={<AgreementGuard userData={userData}><GeminiChatPage userData={userData} /></AgreementGuard>} />
  <Route path="/admin" element={<AdminPage />} />
  <Route path="/help" element={<HelpCenter />} />
  <Route path="/terms" element={<TermsPage />} />
  <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
  <Route path="/verify-email" element={<EmailVerifyPage />} />
  <Route path="/rickroll" element={<RickrollPage />} />
  {/* 404 Not Found Route */}
  <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {/* Site-wide footer ensures visibility on all routes and deployments */}
      <Footer themeMode={themeMode} onChangeThemeMode={setThemeModeHandler} />
    </div>
  );
}

export default App;
