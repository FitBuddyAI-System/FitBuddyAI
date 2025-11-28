import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, User, Flame, Sparkles, Home, Dumbbell } from 'lucide-react';
import { loadQuestionnaireProgress, clearUserData, clearQuestionnaireProgress, clearWorkoutPlan, loadAssessmentData } from '../services/localStorage';
import './Header.css';
import { backupAndDeleteSensitive } from '../services/cloudBackupService';

interface HeaderProps {
  profileVersion: number;
  userData?: any;
  theme: 'theme-light' | 'theme-dark';
}

const Header: React.FC<HeaderProps> = ({ profileVersion, userData }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = React.useState<any | null>(null);
  const [exploreOpen, setExploreOpen] = React.useState(false);
  const exploreRef = React.useRef<HTMLDivElement | null>(null);
  const [motivationMessage, setMotivationMessage] = React.useState<string | null>(null);
  // Try-on preview state (temporary avatar shown when user tries an avatar)
  const [tryOnAvatar, setTryOnAvatar] = React.useState<string | null>(null);

  React.useEffect(() => {
      const updateUser = () => {
      // Prefer explicit prop from App when available
      if (userData) {
        setCurrentUser(userData);
        return;
      }
      try {
        const { loadUserData } = require('../services/localStorage');
        const parsed = loadUserData();
        setCurrentUser(parsed || null);
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
        setExploreOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExploreOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  React.useEffect(() => {
    setExploreOpen(false);
  }, [location.pathname]);

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
    const motivation = resolveMotivation();
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
      case '/questionnaire':
        return 'Fitness Assessment';
      case '/calendar':
        return 'Your Workout Plan';
      case '/profile':
        return 'Your Profile';
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

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="header-left">
          <div className={`explore-launcher nav-dropdown ${exploreOpen ? 'open' : ''}`} ref={exploreRef}>
            <button
              className="explore-button"
              aria-label="Explore"
              aria-expanded={exploreOpen}
              aria-haspopup="true"
              onClick={() => setExploreOpen((open) => !open)}
            >
              <span className="explore-menu-lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="explore-sr-text">Explore menu</span>
            </button>
            <div className="explore-backdrop" aria-hidden="true" onClick={() => setExploreOpen(false)} />
            <div className="dropdown-content explore-dropdown explore-drawer">
              <div className="explore-profile">
                <img
                  src={tryOnAvatar || (currentUser && currentUser.avatar && currentUser.avatar.trim() ? currentUser.avatar : "/images/fitbuddy_head.png")}
                  alt="Profile"
                  className="explore-profile-image"
                  onClick={() => { setExploreOpen(false); navigate(isSignedIn ? '/profile' : '/signin'); }}
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
                    <button onClick={() => { setExploreOpen(false); navigate(isSignedIn ? '/profile' : '/signin'); }}>
                      {isSignedIn ? 'View Profile' : 'Sign In'}
                    </button>
                  </div>
                </div>
              </div>
              <button onClick={() => { setExploreOpen(false); navigate('/?intro=0'); }}>Home</button>
              <button onClick={() => { setExploreOpen(false); navigate('/workouts'); }}>Workouts</button>
              <button onClick={() => { setExploreOpen(false); navigate('/questionnaire'); }}>Assessment</button>
              <button onClick={() => { setExploreOpen(false); navigate('/calendar'); }}>Calendar</button>
              <button
                onClick={() => {
                  try { window.dispatchEvent(new CustomEvent('fitbuddyai-open-chat')); } catch {}
                  setExploreOpen(false);
                  navigate('/chat');
                }}
              >
                Chat
              </button>
              <button onClick={() => { setExploreOpen(false); navigate('/nutrition'); }}>Nutrition</button>
              <button onClick={() => { setExploreOpen(false); navigate('/blog'); }}>Blog</button>
              <button onClick={() => { setExploreOpen(false); navigate('/pricing'); }}>Pricing</button>
              <button onClick={() => { setExploreOpen(false); navigate('/shop'); }} className="dropdown-shop">Shop</button>
              <button onClick={() => { setExploreOpen(false); navigate('/my-plan'); }}>My Plan</button>
              {isSignedIn && (
                <div className="explore-footer">
                  <button onClick={() => { setExploreOpen(false); navigate('/profile/settings'); }}>Settings</button>
                </div>
              )}
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
          <button
            className={`nav-button ${isActive('/') ? 'active' : ''}`}
            onClick={() => navigate('/?intro=0')}
            aria-label="Home"
          >
            <Home size={20} className="home-icon" />
            <span>Home</span>
          </button>
          <button
            className={`nav-button ${isActive('/questionnaire') ? 'active' : ''}`}
            onClick={() => {
              const savedProgress = loadQuestionnaireProgress();
              if (savedProgress?.completed) {
                navigate('/questionnaire?edit=true');
              } else {
                navigate('/questionnaire');
              }
            }}
            aria-label="Questionnaire"
          >
            <User size={20} />
            <span>Assessment</span>
          </button>
          <button
            className={`nav-button ${isActive('/calendar') ? 'active' : ''}`}
            onClick={() => navigate('/calendar')}
            aria-label="Workout Calendar"
            title={!isSignedIn ? 'Sign in to save and sync your calendar' : 'Open calendar'}
          >
            <Calendar size={20} />
            <span>Calendar</span>
          </button>

          <button
            className={`nav-button ${isActive('/chat') ? 'active' : ''}`}
            onClick={() => {
              try { window.dispatchEvent(new CustomEvent('fitbuddyai-open-chat')); } catch {}
              navigate('/chat');
            }}
            aria-label="Chat with AI Coach"
          >
            <span className="sparkles-mobile-only"><Sparkles size={20} /></span>
            <span>Chat</span>
          </button>

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
                          try { clearWorkoutPlan(); } catch {}
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
