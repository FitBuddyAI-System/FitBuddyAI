import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Flame, Sparkles } from 'lucide-react';
import { loadQuestionnaireProgress, clearUserData, clearQuestionnaireProgress, loadAssessmentData, loadWorkoutPlan } from '../services/localStorage';
import './Header.css';
import { backupAndDeleteSensitive } from '../services/cloudBackupService';
import { loadSavedNames, subscribeSavedNames } from '../utils/savedNames';

interface HeaderProps {
  profileVersion: number;
  userData?: any;
  theme: 'theme-light' | 'theme-dark';
}

type ExploreDrawerState = 'closed' | 'open' | 'closing';

const normalizeDateToDay = (value: string | Date | undefined | null): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : new Date(value as any);
  if (!date || Number.isNaN(date.getTime())) return null;
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const getUpcomingWorkoutCount = (plan: any | null): number => {
  if (!plan || !Array.isArray(plan.dailyWorkouts)) return 0;
  const today = normalizeDateToDay(new Date());
  if (!today) return 0;
  return plan.dailyWorkouts.reduce((count: number, day: any) => {
    if (!day) return count;
    if (day.completed) return count;
    const date = normalizeDateToDay(day.date);
    if (!date) return count;
    if (date.getTime() < today.getTime()) return count;
    const type = typeof day.type === 'string' ? day.type.toLowerCase() : '';
    if (type === 'rest') return count;
    if (Array.isArray(day.workouts) && day.workouts.length === 0) return count;
    return count + 1;
  }, 0);
};

const Header: React.FC<HeaderProps> = ({ profileVersion, userData }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide header while the intro overlay is active
  const [introActive, setIntroActive] = React.useState(false);
  React.useEffect(() => {
    const onStart = () => setIntroActive(true);
    const onEnd = () => setIntroActive(false);
    // Initialize from body class in case the event fired before this component mounted
    try {
      const already = Boolean(document && document.body && document.body.classList && document.body.classList.contains('intro-active'));
      if (already) setIntroActive(true);
    } catch (e) {}
    try {
      window.addEventListener('fitbuddyai-intro-start', onStart as EventListener);
      window.addEventListener('fitbuddyai-intro-end', onEnd as EventListener);
    } catch (e) {
      // ignore (SSR / non-browser)
    }
    return () => {
      try {
        window.removeEventListener('fitbuddyai-intro-start', onStart as EventListener);
        window.removeEventListener('fitbuddyai-intro-end', onEnd as EventListener);
      } catch (e) {}
    };
  }, []);

  const [currentUser, setCurrentUser] = React.useState<any | null>(null);
  const [drawerState, setDrawerState] = React.useState<ExploreDrawerState>('closed');
  const exploreRef = React.useRef<HTMLDivElement | null>(null);
  const [motivationMessage, setMotivationMessage] = React.useState<string | null>(null);
  const motivationKeyRef = React.useRef<string | null>(null);
  const [savedWorkoutCount, setSavedWorkoutCount] = React.useState<number>(() => loadSavedNames().length);
  const [upcomingWorkoutCount, setUpcomingWorkoutCount] = React.useState<number>(() => getUpcomingWorkoutCount(loadWorkoutPlan()));
  const isDrawerVisible = drawerState !== 'closed';
  const isDrawerClosing = drawerState === 'closing';
  const toggleExploreDrawer = React.useCallback(() => {
    setDrawerState((prev) => (prev === 'open' ? 'closing' : 'open'));
  }, []);
  const closeExploreDrawer = React.useCallback(() => {
    setDrawerState((prev) => (prev === 'open' ? 'closing' : prev));
  }, []);
  const handleDrawerTransitionEnd = React.useCallback((event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'transform') return;
    setDrawerState((prev) => (prev === 'closing' ? 'closed' : prev));
  }, []);
  // Base64 decode helper (handles browser and Node dev env)
  const b64Decode = (s: string) => {
    try {
      if (typeof window !== 'undefined' && typeof window.atob === 'function') {
        // decode unicode-safe
        return decodeURIComponent(escape(window.atob(s)));
      }
      // Node.js fallback
      // @ts-ignore
      if (typeof Buffer !== 'undefined') return Buffer.from(s, 'base64').toString('utf8');
    } catch (e) {}
    return '';
  };
  // Try-on preview state (temporary avatar shown when user tries an avatar)
  const [tryOnAvatar, setTryOnAvatar] = React.useState<string | null>(null);

  React.useEffect(() => {
      const normalize = (candidate: any) => {
        if (!candidate) return null;
        // If the app sometimes passes a wrapper { data: { ... } }, unwrap it
        if (candidate.data && typeof candidate.data === 'object') return candidate.data;
        return candidate;
      };

      const updateUser = () => {
        // Prefer explicit prop from App when available
        if (userData) {
          setCurrentUser(normalize(userData));
          return;
        }
        try {
          const { loadUserData } = require('../services/localStorage');
          const parsed = loadUserData();
          setCurrentUser(normalize(parsed) || null);
        } catch {
          setCurrentUser(null);
        }
      };
  updateUser();
    window.addEventListener('storage', updateUser);
    // Listen for shop try-on events
    const onTry = (e: any) => {
      try {
        const preview = e?.detail?.preview;
        if (preview?.type === 'avatar' && preview?.image) {
          setTryOnAvatar(preview.image);
          // revert after 4s
          setTimeout(()=>setTryOnAvatar(null), 4000);
        }
        // For powerups we could trigger small animations (left for later)
      } catch {}
    };
    window.addEventListener('shop-try-on', onTry as EventListener);
    // initial run then throttle; avoid polling while page hidden
    updateUser();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      updateUser();
    }, 15000);
    return () => {
      window.removeEventListener('storage', updateUser);
  window.removeEventListener('shop-try-on', onTry as EventListener);
      clearInterval(interval);
    };
  }, [location.pathname, profileVersion, userData]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exploreRef.current && !exploreRef.current.contains(event.target as Node)) {
        closeExploreDrawer();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeExploreDrawer();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closeExploreDrawer]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    setSavedWorkoutCount(loadSavedNames().length);
    const unsubscribe = subscribeSavedNames((list) => setSavedWorkoutCount(list.length));
    return () => {
      try {
        unsubscribe();
      } catch {}
    };
  }, []);


  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const refresh = () => setUpcomingWorkoutCount(getUpcomingWorkoutCount(loadWorkoutPlan()));
    refresh();
    const handler = () => refresh();
    window.addEventListener('storage', handler);
    window.addEventListener('fitbuddyai-workout-plan-updated', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('fitbuddyai-workout-plan-updated', handler);
    };
  }, []);

  // Toggle a body-level class when the explore drawer is open so we can
  // apply page-wide blur while keeping the header visually sharp.
  React.useEffect(() => {
    try {
      if (isDrawerVisible) {
        document.body.classList.add('explore-open');
      } else {
        document.body.classList.remove('explore-open');
      }
    } catch (e) {
      // ignore (server-side rendering / unavailable document)
    }
    return () => {
      try { document.body.classList.remove('explore-open'); } catch (e) {}
    };
  }, [isDrawerVisible]);

  React.useEffect(() => {
    closeExploreDrawer();
  }, [location.pathname, closeExploreDrawer]);

  React.useEffect(() => {
    const name = (() => {
      const uname = (currentUser as any)?.username?.trim();
      return uname || 'Friend';
    })();
    const resolveMotivation = () => {
      try {
        const userMotivation = (currentUser as any)?.motivation;
        const assessment = loadAssessmentData();
        const progress = loadQuestionnaireProgress();
        return (
          userMotivation ||
          (assessment && assessment.motivation) ||
          (progress && (progress as any).answers?.motivation) ||
          null
        );
      } catch {
        return null;
      }
    };

    // Special-case for a particular user: display a themed message once per load
    const rawName = ((currentUser as any)?.username || '').toString().trim();
    const lower = rawName.toLowerCase();

    // Construct encoded tokens without exposing plain keywords in source.
    const fromCodes = (arr: number[]) => String.fromCharCode(...arr);
    const safeBtoa = (str: string) => {
      try {
        if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
          // Use unicode-safe encoding so characters outside Latin1 don't throw
          return window.btoa(unescape(encodeURIComponent(str)));
        }
        // Node fallback
        // @ts-ignore
        if (typeof Buffer !== 'undefined') return Buffer.from(str).toString('base64');
      } catch (e) {}
      return '';
    };
    const encA = (() => { const s = fromCodes([100,97,107,111,116,97]); return safeBtoa(s); })();
    const encB = (() => { const s = fromCodes([100,114,98]); return safeBtoa(s); })();
    const encC = (() => { const s = fromCodes([98,97,108,100,119,105,110]); return safeBtoa(s); })();

    const isSpecialUser = ((): boolean => {
      try {
        const a = b64Decode(encA);
        const b = b64Decode(encB);
        const c = b64Decode(encC);
        return lower === a || lower === b || (lower.includes(a) && lower.includes(c));
      } catch { return false; }
    })();

    if (isSpecialUser) {
      // Messages are stored as base64-encoded literals built without raw keywords in source.
      const buildEnc = (codes: number[]) => {
        const plain = fromCodes(codes);
        return safeBtoa(plain);
      };

      const specialMessagesB64 = [
        buildEnc([68,97,107,111,116,97,32,82,97,121,32,66,97,108,100,119,105,110,44,32,98,101,105,110,103,32,97,32,110,101,114,100,32,105,115,32,121,111,117,114,32,119,104,121,46,32,82,101,97,100,121,32,116,111,32,98,101,32,111,110,101,32,116,111,100,97,121,63]),
        buildEnc([68,97,107,111,116,97,32,82,97,121,32,66,97,108,100,119,105,110,32,45,32,101,109,98,114,97,99,101,32,116,104,101,32,110,101,114,100,44,32,109,97,107,101,32,105,116,32,99,111,117,110,116,32,116,111,100,97,121,46]),
        buildEnc([68,97,107,111,116,97,32,82,97,121,32,66,97,108,100,119,105,110,44,32,98,101,105,110,103,32,97,32,110,101,114,100,32,110,101,118,101,114,32,108,111,111,107,101,100,32,115,111,32,103,111,111,100,46,32,76,101,116,8217,115,32,103,111,33]),
        buildEnc([68,97,107,111,116,97,32,82,97,121,32,66,97,108,100,119,105,110,44,32,116,104,101,32,110,101,114,100,32,101,110,101,114,103,121,32,105,115,32,115,116,114,111,110,103,32,116,111,100,97,121,46,32,85,115,101,32,105,116,46]),
        buildEnc([68,97,107,111,116,97,32,82,97,121,32,66,97,108,100,119,105,110,44,32,110,101,114,100,32,109,111,100,101,58,32,79,78,46,32,76,101,116,8217,115,32,119,105,110,32,116,104,105,115,32,115,101,115,115,105,111,110,46]),
        buildEnc([68,97,107,111,116,97,32,82,97,121,32,66,97,108,100,119,105,110,32,45,32,110,101,114,100,115,32,98,117,105,108,100,32,109,111,109,101,110,116,117,109,46,32,84,105,109,101,32,116,111,32,98,117,105,108,100,32,115,111,109,101,46]),
        buildEnc([68,97,107,111,116,97,32,82,97,121,32,66,97,108,100,119,105,110,44,32,121,111,117,114,32,110,101,114,100,45,112,111,119,101,114,32,105,115,32,116,104,101,32,115,101,99,114,101,116,32,115,97,117,99,101,32,45,32,115,116,105,114,32,105,116,32,117,112,46]),
        buildEnc([68,97,107,111,116,97,32,82,97,121,32,66,97,108,100,119,105,110,44,32,114,101,97,100,121,32,116,111,32,110,101,114,100,32,111,117,116,32,97,110,100,32,99,114,117,115,104,32,103,111,97,108,115,63]),
        buildEnc([68,97,107,111,116,97,32,82,97,121,32,66,97,108,100,119,105,110,44,32,115,101,114,105,111,117,115,32,110,101,114,100,32,101,110,101,114,103,121,32,100,101,116,101,99,116,101,100,32,45,32,99,104,97,110,110,101,108,32,105,116,46]),
        buildEnc([68,97,107,111,116,97,32,82,97,121,32,66,97,108,100,119,105,110,44,32,97,32,108,105,116,116,108,101,32,110,101,114,100,105,110,101,115,115,32,103,111,101,115,32,97,32,108,111,110,103,32,119,97,121,32,45,32,108,101,116,8217,115,32,103,111,46]),
        buildEnc([68,97,107,111,116,97,32,82,97,121,32,66,97,108,100,119,105,110,44,32,98,101,32,112,114,111,117,100,32,116,111,32,98,101,32,97,32,110,101,114,100,32,45,32,121,111,117,8217,118,101,32,103,111,116,32,116,104,105,115,46]),
        buildEnc([68,97,107,111,116,97,32,82,97,121,32,66,97,108,100,119,105,110,32,45,32,110,101,114,100,32,116,111,100,97,121,44,32,115,116,114,111,110,103,101,114,32,116,111,109,111,114,114,111,119,46]),
        buildEnc([68,97,107,111,116,97,32,82,97,121,32,66,97,108,100,119,105,110,44,32,110,101,114,100,45,102,111,99,117,115,32,101,110,103,97,103,101,100,46,32,84,105,109,101,32,116,111,32,109,111,118,101,46]),
        buildEnc([68,97,107,111,116,97,32,82,97,121,32,66,97,108,100,119,105,110,44,32,121,111,117,114,32,110,101,114,100,105,110,101,115,115,32,105,115,32,97,110,32,97,115,115,101,116,32,45,32,119,101,105,108,100,32,105,116,32,119,101,108,108,46]),
        buildEnc([68,97,107,111,116,97,32,82,97,121,32,66,97,108,100,119,105,110,44,32,101,118,101,110,32,110,101,114,100,115,32,110,101,101,100,32,97,32,118,105,99,116,111,114,121,32,100,97,110,99,101,32,45,32,101,97,114,110,32,105,116,46])
      ];

      const key = `special:${rawName}`;
      if (motivationKeyRef.current === key) return;
      motivationKeyRef.current = key;
      const pickSpecial = specialMessagesB64[Math.floor(Math.random() * specialMessagesB64.length)];
      setMotivationMessage(b64Decode(pickSpecial));
      return;
    }

    // Default behavior for other users: only refresh when identity or motivation truly changes
    const motivation = resolveMotivation();
    const key = `motivation:${rawName}:${motivation || ''}`;
    if (motivationKeyRef.current === key) {
      return;
    }
    motivationKeyRef.current = key;
    if (!motivation) {
      setMotivationMessage(`Hello, ${name}! 👋`);
      return;
    }
    const templates = [
      `Pushing for "${motivation}" today—let's make it count, ${name}!`,
      `${name}, "${motivation}" is your why. I've lined up steps to match it.`,
      `Fueled by "${motivation}". I'm ready when you are, ${name}.`,
      `Keeping "${motivation}" front and center. Let's roll, ${name}!`,
      `${name}, let's turn "${motivation}" into momentum today.`,
      `All about "${motivation}"—I'll keep you on track, ${name}.`
    ];
    const pick = templates[Math.floor(Math.random() * templates.length)];
    setMotivationMessage(pick);
  }, [currentUser, profileVersion]);

  // Determine admin status from currentUser or fallback to localStorage / JWT payload
  const isAdmin = React.useMemo(() => {
      try {
      const candidate = currentUser || (() => {
        try { const { loadUserData } = require('../services/localStorage'); return loadUserData() || null; } catch { return null; }
      })();
      if (!candidate) return false;
      // Direct role on user object
      if (candidate.role && String(candidate.role).toLowerCase() === 'admin') return true;
      // Some token shapes store role in token payload
      const token = candidate?.token || candidate?.access_token || null;
      if (token && typeof token === 'string') {
        try {
          const parts = token.split('.');
          if (parts.length >= 2) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            const roles = payload?.roles || payload?.role || payload?.roles?.join?.(',');
            if (Array.isArray(roles) && roles.includes('admin')) return true;
            if (String(roles).toLowerCase() === 'admin') return true;
          }
        } catch {}
      }
      // fallback: username 'admin'
      if (String(candidate.username || '').toLowerCase() === 'admin') return true;
      return false;
    } catch {
      return false;
    }
  }, [currentUser]);

  // Consider a user "signed in" only if they have an account identifier or token.
  const isSignedIn = React.useMemo(() => {
    try {
      if (!currentUser) return false;
      if (currentUser.id) return true;
      if (currentUser.sub) return true;
      // Tokens are now stored in sessionStorage via getAuthToken
      return false;
    } catch { return false; }
  }, [currentUser]);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Welcome to FitBuddyAI';
      case '/workouts':
        return 'Workout Library';
      case '/library':
        return 'Saved Workouts';
      case '/questionnaire':
        return 'Fitness Assessment';
      case '/calendar':
        return 'Your Workout Plan';
      case '/profile':
        return 'Your Profile';
      case '/profile/achievements':
        return 'Achievements';
      case '/signin':
        return 'Sign In';
      case '/signup':
        return 'Sign Up';
      case '/chat':
        return 'Chat with AI Coach';
      default:
        return 'FitBuddyAI';
    }
  };

  const isActive = (path: string) => location.pathname === path;

  if (introActive) return null;

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="header-left">
          <div className={`explore-launcher nav-dropdown ${isDrawerVisible ? 'open' : ''}`} ref={exploreRef}>
            <button
              className="explore-button"
              aria-label="Explore"
              aria-expanded={isDrawerVisible}
              aria-haspopup="true"
              onClick={toggleExploreDrawer}
            >
              <span className="explore-menu-lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="explore-sr-text">Explore menu</span>
            </button>
            <div className="explore-backdrop" aria-hidden="true" onClick={closeExploreDrawer} />
            <div
              className={`dropdown-content explore-dropdown explore-drawer${isDrawerVisible ? ' active' : ''}${isDrawerClosing ? ' closing' : ''}`}
              onTransitionEnd={handleDrawerTransitionEnd}
            >
              <div className="explore-drawer-content">
                <div className="explore-profile">
                  <img
                    src={tryOnAvatar || (currentUser && currentUser.avatar && currentUser.avatar.trim() ? currentUser.avatar : "/images/fitbuddy_head.png")}
                    alt="Profile"
                    className="explore-profile-image"
                    onClick={() => { closeExploreDrawer(); navigate(isSignedIn ? '/profile' : '/signin'); }}
                  />
                  <div className="explore-profile-text">
                    <div className="explore-profile-name">
                      {isSignedIn ? (((currentUser?.username && currentUser.username.trim()) || 'User')) : 'Sign in to personalize'}
                    </div>
                    {isSignedIn && (
                      <div className="explore-profile-counters">
                        <div className="header-counter streak">
                          <Flame size={18} color="#ffb347" style={{ marginRight: 4 }} />
                          <span className="counter-value">{currentUser?.streak ?? 0}</span>
                        </div>
                        <div className="header-counter energy">
                          <Sparkles size={18} color="#1e90cb" style={{ marginRight: 4 }} />
                          <span className="counter-value">{currentUser?.energy ?? 0}</span>
                        </div>
                      </div>
                    )}
                    <div className="explore-profile-actions">
                      <button onClick={() => { closeExploreDrawer(); navigate(isSignedIn ? '/profile' : '/signin'); }}>
                        {isSignedIn ? 'View Profile' : 'Sign In'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="explore-drawer-links">
                  <button onClick={() => { closeExploreDrawer(); navigate('/?intro=0'); }}>Home</button>
                  <button onClick={() => { closeExploreDrawer(); navigate('/workouts'); }}>Workout Library</button>
                  <button
                    className="saved-workouts-link"
                    aria-label={`Saved Workouts (${savedWorkoutCount} saved)`}
                    onClick={() => { closeExploreDrawer(); navigate('/library'); }}
                  >
                    <span>Saved Workouts</span>
                    <span className="saved-workouts-badge badge-circle" aria-hidden="true">
                      {savedWorkoutCount}
                    </span>
                  </button>
                  <button onClick={() => { closeExploreDrawer(); navigate('/questionnaire'); }}>Assessment</button>
                  <button
                    className="calendar-link"
                    aria-label={`Calendar (${upcomingWorkoutCount} upcoming workouts)`}
                    onClick={() => { closeExploreDrawer(); navigate('/calendar'); }}
                  >
                    <span>Calendar</span>
                    <span className="badge-circle" aria-hidden="true">
                      {upcomingWorkoutCount}
                    </span>
                  </button>
                  {isSignedIn && (
                    <button onClick={() => { closeExploreDrawer(); navigate('/profile/achievements'); }}>Achievements</button>
                  )}
                  <button
                    onClick={() => {
                      try { window.dispatchEvent(new CustomEvent('fitbuddyai-open-chat')); } catch {}
                      closeExploreDrawer();
                      navigate('/chat');
                    }}
                  >
                    Chat
                  </button>
                  <button onClick={() => { closeExploreDrawer(); navigate('/blog'); }}>Blog</button>
                  {/* Pricing temporarily removed from the drawer; keep code for quick reinstatement. */}
                  {false && (
                    <button onClick={() => { closeExploreDrawer(); navigate('/pricing'); }}>Pricing</button>
                  )}
                  <button onClick={() => { closeExploreDrawer(); navigate('/shop'); }} >Shop</button>
                  {isSignedIn && (
                    <div className="explore-footer">
                      <button onClick={() => { closeExploreDrawer(); navigate('/profile/settings'); }}>Settings</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Page Title */}
          <div className="page-title centered-title">
            <h2>{getPageTitle()}</h2>
            {currentUser && motivationMessage && (
              <p className="user-greeting">{motivationMessage}</p>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="header-nav">
          {/* theme toggle removed: theme controlled in footer via selector */}

          {isAdmin && (
            <button
              className={`nav-button ${isActive('/admin') ? 'active' : ''}`}
              onClick={() => navigate('/admin')}
              aria-label="Admin"
            >
              <span className="flame-mobile-only"><Flame size={20} /></span>
              <span>Admin</span>
            </button>
          )}

          {/* Streak and Energy Counters */}
          {isSignedIn && (
            <>
              <div className="header-counters">
                <div className="header-counter streak">
                  <Flame size={20} color="#ffb347" style={{ marginRight: 4 }} />
                  <span className="counter-value">{currentUser?.streak ?? 0}</span>
                </div>
                <div className="header-counter energy">
                  <Sparkles size={20} color="#1e90cb" style={{ marginRight: 4 }} />
                  <span className="counter-value">{currentUser?.energy ?? 0}</span>
                </div>
              </div>
            </>
          )}
          <div className="profile-section">
            <img
              src={tryOnAvatar || (currentUser && currentUser.avatar && currentUser.avatar.trim() ? currentUser.avatar : "/images/fitbuddy_head.png")}
              alt="Profile"
              className="profile-image"
              onClick={() => navigate(isSignedIn ? '/profile' : '/signin')}
            />
            <div className="dropdown">
              <button className="dropdown-button" onClick={() => navigate(isSignedIn ? '/profile' : '/signin')}>
                {isSignedIn ? (((currentUser.username && currentUser.username.trim()) || 'User')) : 'Sign In'}
              </button>
              <div className="dropdown-content">
                {isSignedIn ? (
                  <>
                    <button onClick={() => navigate('/profile')}> Profile</button>
                    <button onClick={() => navigate('/profile/settings')}>Settings</button>
                    <button onClick={() => navigate('/profile/friends')}>Friends</button>
                    <button onClick={() => navigate('/profile/achievements')}>Achievements</button>
                    <button onClick={() => {
                        // Mirror SignOutButton behavior: attempt to backup sensitive keys before clearing
                        (async () => {
                          try { localStorage.setItem('fitbuddyai_no_auto_restore', '1'); } catch {}
                          try { sessionStorage.setItem('fitbuddyai_no_auto_restore', '1'); } catch {}
                          try {
                            const { loadUserData } = await import('../services/localStorage');
                            const parsed = loadUserData();
                            const userId = parsed?.id || parsed?.sub || parsed?.data?.id || null;
                            if (userId) {
                              const p = (async () => { try { await backupAndDeleteSensitive(String(userId)); } catch {} })();
                              const timeout = new Promise((res) => setTimeout(res, 2000));
                              await Promise.race([p, timeout]);
                            }
                          } catch (e) {}

                          // Now clear stored user and related data using helpers
                          try { clearUserData(); } catch {}
                          try { clearQuestionnaireProgress(); } catch {}
                          // Also call legacy signOut to remove any auth cookies/local keys if needed
                          try { /* legacy signOut is handled elsewhere */ } catch {}
                          // Notify app and navigate to sign-in
                          window.dispatchEvent(new Event('fitbuddyai-logout'));
                          navigate('/signin');
                        })();
                      }}>Sign Out</button>
                    </>
                  ) : (
                    <button onClick={() => navigate('/signin')}>Sign In</button>
                  )}
                </div>
              </div>
            </div>
        </nav>
      </div>
    </header>
  );
};

export default Header;
