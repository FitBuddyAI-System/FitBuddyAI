import WelcomePage from './components/WelcomePage';
import Questionnaire from './components/Questionnaire';
import { useNavigate } from 'react-router-dom';
import WorkoutCalendar from './components/WorkoutCalendar';
import AgreementGuard from './components/AgreementGuard';
import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';

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



function App() {
  const [userData, setUserData] = useState<any | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [planVersion, setPlanVersion] = useState(0);
  const navigate = useNavigate();
  const [profileVersion, setProfileVersion] = useState(0);

  // Cloud backup/restore integration
  useCloudBackup();

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
    window.addEventListener('fitbuddyaiai-logout', handleLogout);
    return () => window.removeEventListener('fitbuddyaiai-logout', handleLogout);
  }, []);

  // Listen for login event (dispatched after sign-in/restore) and sync saved data into state
  useEffect(() => {
    const handleLogin = () => {
      const savedUserData = loadUserData();
      const savedWorkoutPlan = loadWorkoutPlan();
      if (savedUserData) setUserData(savedUserData);
  if (savedWorkoutPlan) { setWorkoutPlan(savedWorkoutPlan); setPlanVersion(v => v + 1); }
    };
    window.addEventListener('fitbuddyaiai-login', handleLogin);
    return () => window.removeEventListener('fitbuddyaiai-login', handleLogin);
  }, []);

  // Listen for localStorage changes to fitbuddyaiai_user_data and update userData state
  useEffect(() => {
    const syncUser = () => {
      const updated = loadUserData();
      if (updated && (!userData || updated.id === userData.id)) {
        setUserData(updated);
      }
    };
    // Listen for legacy storage events (keeps backward compat) and BroadcastChannel messages
    window.addEventListener('storage', syncUser);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('fitbuddyaiai');
      bc.onmessage = () => syncUser();
    } catch (e) {
      // ignore if not available
    }
    return () => {
      window.removeEventListener('storage', syncUser);
      try { if (bc) { bc.close(); } } catch (e) {}
    };
  }, [userData]);


  // Load saved data on startup and always fetch user from server if logged in
  useEffect(() => {
    const savedUserData = loadUserData();
    const savedWorkoutPlan = loadWorkoutPlan();
  console.log('App startup - loadUserData ->', savedUserData);
  console.log('App startup - loadWorkoutPlan ->', savedWorkoutPlan);
    if (savedUserData) {
      setUserData(savedUserData);
      // Fetch latest from server
      if (savedUserData.id) {
        fetchUserById(savedUserData.id).then(freshUser => {
          if (freshUser) setUserData(freshUser);
        });
      }
    }
    if (savedWorkoutPlan) {
  setWorkoutPlan(savedWorkoutPlan);
  setPlanVersion(v => v + 1);
    }
  }, []);

  // Save data when it changes, but do not save if userData is null (prevents refresh after logout)
  useEffect(() => {
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
  }, [userData]);

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

  return (
    <div className="App">
      <Header userData={userData} profileVersion={profileVersion} />
      <AgreementBanner userData={userData} />
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/profile" element={<ProfilePage userData={userData} onProfileUpdate={(user) => { setUserData(user); setProfileVersion(v => v + 1); }} profileVersion={profileVersion} />} />
        <Route path="/loading" element={<LoadingPage />} />
        <Route 
          path="/questionnaire" 
          element={
            <Questionnaire 
              onComplete={(data, plan) => {
                setUserData(data);
                // use wrapper to ensure calendar re-renders when plan is set
                setWorkoutPlan(plan);
                setPlanVersion(v => v + 1);
                navigate('/calendar');
              }} 
            />
          } 
        />
        <Route 
          path="/calendar" 
          element={
            <AgreementGuard userData={userData}>
              <WorkoutCalendar 
                key={planVersion}
                workoutPlan={workoutPlan}
                userData={userData}
                onUpdatePlan={(plan) => { setWorkoutPlan(plan); setPlanVersion(v => v + 1); }}
              />
            </AgreementGuard>
          } 
        />
        <Route 
          path="/shop"
          element={<ShopPage user={userData || { energy: 0, inventory: [] }} onPurchase={handleShopPurchase} />} 
        />
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
    </div>
  );
}

export default App;
