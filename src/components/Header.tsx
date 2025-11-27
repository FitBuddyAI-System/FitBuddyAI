import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, User, Flame, Sparkles, Home } from 'lucide-react';
import { loadQuestionnaireProgress, clearUserData, clearQuestionnaireProgress, clearWorkoutPlan } from '../services/localStorage';
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
        return 'Chat with Buddy';
      default:
        return 'FitBuddyAI';
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Page Title */}
        <div className="page-title centered-title">
          <h2>{getPageTitle()}</h2>
          {currentUser && (
            (() => {
              const uname = (currentUser as any).username?.trim();
              const fallbackName = (currentUser as any).username?.trim();
              const displayName = uname || fallbackName || 'User';
              return <p className="user-greeting">Hello, {displayName}! 👋</p>;
            })()
          )}
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
            disabled={!isSignedIn}
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
            aria-label="Chat with Buddy"
          >
            <span className="sparkles-mobile-only"><Sparkles size={20} /></span>
            <span>Chat</span>
          </button>

          <div className="nav-dropdown">
            <button className="nav-button" aria-label="Explore">Explore ▾</button>
            <div className="dropdown-content">
              <button onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button onClick={() => navigate('/workouts')}>Workouts</button>
              <button onClick={() => navigate('/nutrition')}>Nutrition</button>
              <button onClick={() => navigate('/blog')}>Blog</button>
              <button onClick={() => navigate('/pricing')}>Pricing</button>
              <button onClick={() => navigate('/shop')} className="dropdown-shop">Shop</button>
            </div>
          </div>

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
