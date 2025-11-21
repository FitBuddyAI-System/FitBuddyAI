
import React, { useEffect, useState } from 'react';
// import { Lock } from 'lucide-react';
import './ProfilePage.css';
import { getCurrentUser, fetchUserById } from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import SignOutButton from './SignOutButton';



interface ProfilePageProps {
  userData: any;
  onProfileUpdate: (user: any) => void;
  profileVersion: number;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ userData, onProfileUpdate }) => {
  const [user, setUser] = useState(userData || getCurrentUser());
  // Remove stats state, always use user for stats
  const [editMode, setEditMode] = useState(false);
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar || '/images/fitbuddyai_head.png');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Poll server for live user stats periodically and update localStorage. Throttle
  // polling interval and avoid polling when page is hidden.
  useEffect(() => {
    let stopped = false;
    const updateUser = async () => {
      try {
        if (stopped) return;
        const local = getCurrentUser();
        if (!local?.id) return;
        if (typeof document !== 'undefined' && document.hidden) return;
        const fresh = await fetchUserById(local.id);
        if (!stopped && fresh) setUser(fresh);
      } catch (e) {
        // ignore errors silently
      }
    };
    // run once immediately, then every 15s
    updateUser();
    const interval = setInterval(updateUser, 15000);
    return () => { stopped = true; clearInterval(interval); };
  }, []);

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-card fade-in-bounce">
          <div className="profile-avatar-bg">
            <img
              src="/images/fitbuddyai_head.png"
              alt="User Avatar"
              className="avatar"
              data-testid="profile-avatar"
            />
          </div>
          <h1 className="profile-username-gradient">Guest</h1>
          <div className="profile-actions-row">
            <button className="btn edit-profile" onClick={() => navigate('/signin')}>Sign In</button>
            <button className="btn view-achievements" onClick={() => navigate('/signup')}>Sign Up</button>
          </div>
          <p className="not-logged-in-desc">Sign in to track your workouts, earn energy, and unlock achievements!</p>
        </div>
      </div>
    );
  }

  // Shop avatars (must match ShopPage)
  const shopAvatars = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=FitBuddyAI1',
    'https://api.dicebear.com/7.x/bottts/svg?seed=DragonHead',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Duolingo',
  ];
  const premadeAvatars = [
    '/images/fitbuddyai_head.png',
    ...shopAvatars,
    'https://api.dicebear.com/7.x/bottts/svg?seed=FitBuddyAI2',
    'https://api.dicebear.com/7.x/bottts/svg?seed=FitBuddyAI3',
    'https://api.dicebear.com/7.x/bottts/svg?seed=FitBuddyAI4',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Pizza',
    'https://we09532.github.io/Image_Hosting/Fishwins/Fishwin_Head.png',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Language',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Fitness',
    'https://media1.giphy.com/media/4bjIKBOWUnVPICCzJc/source.gif'
  ];

  const handleEdit = () => {
    setEditUsername(user?.username || '');
    setEditAvatar(user?.avatar || '/images/fitbuddyai_head.png');
    setEditMode(true);
    setError('');
  };

  const handleCancel = () => {
    setEditMode(false);
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/user?action=update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, username: editUsername, avatar: editAvatar })
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated.user);
        onProfileUpdate(updated.user);
        setEditMode(false);
        // Try to update Supabase auth metadata for the current session so display name updates immediately
        try {
          const displayName = updated.user?.username;
          if (displayName && supabase && typeof supabase.auth?.updateUser === 'function') {
            await supabase.auth.updateUser({ data: { display_name: displayName, username: displayName } });
          }
        } catch (e) {
          console.warn('[ProfilePage] failed to update supabase user metadata', e && (e as any).message || String(e));
        }
  } else {
  // Server endpoint missing (common for static prod deployments).
  // Fall back to a local-only save via saveUserData to avoid persisting tokens into localStorage.
  const fallbackUser = { ...user, username: editUsername, avatar: editAvatar };
  try { const { saveUserData } = await import('../services/localStorage'); saveUserData({ data: fallbackUser }); } catch {}
  setUser(fallbackUser);
  onProfileUpdate(fallbackUser);
  setEditMode(false);
  setError('Saved locally (session) — server unavailable.');
      }
    } catch (e: any) {
      // Network or other error — fall back to local save so edits persist in session storage
      const fallbackUser = { ...user, username: editUsername, avatar: editAvatar };
      try {
        const { saveUserData } = await import('../services/localStorage'); saveUserData({ data: fallbackUser });
      } catch {}
      setUser(fallbackUser);
      onProfileUpdate(fallbackUser);
      setEditMode(false);
      setError('Saved locally (network error).');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-card fade-in-bounce">
        <div className="profile-avatar-bg">
          <img
            src={editMode ? editAvatar : (user.avatar || '/images/fitbuddy_head.png')}
            alt="User Avatar"
            className="avatar"
            data-testid="profile-avatar"
          />
        </div>
        {editMode ? (
          <>
            <div className="avatar-select-row">
              {premadeAvatars.map((url) => {
                // Lock shop avatars unless user owns them
                const isShopAvatar = shopAvatars.includes(url);
                const ownsAvatar = !isShopAvatar || (Array.isArray(user.inventory) && user.inventory.some((item: any) => item.image === url));
                return (
                  <button
                    key={url}
                    className={`avatar-select-btn${editAvatar === url ? ' selected' : ''}${!ownsAvatar ? ' locked' : ''}`}
                    onClick={() => {
                      if (ownsAvatar) {
                        setEditAvatar(url);
                      } else {
                        navigate('/shop');
                      }
                    }}
                    type="button"
                    aria-label={ownsAvatar ? 'Choose avatar' : 'Locked avatar'}
                  >
                    {!ownsAvatar && <span className="avatar-lock-emoji">🔒</span>}
                    <img src={url} alt="avatar option" className="avatar avatar-option" />
                  </button>
                );
              })}
            </div>
            <input
              className="edit-username-input"
              value={editUsername}
              onChange={e => setEditUsername(e.target.value)}
              maxLength={20}
              placeholder="Username"
            />
            {error && <div className="edit-error">{error}</div>}
            <div className="profile-actions-row">
              <button className="btn edit-profile" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn view-achievements" onClick={handleCancel} disabled={saving}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <h1 className="profile-username-gradient">{user.username}</h1>
            <div className="profile-stats-row">
              <div className="profile-stat">
                <span className="profile-stat-label">Workouts</span>
                <span className="profile-stat-value">{user?.workouts?.length ?? '-'}</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-label">Streak</span>
                <span className="profile-stat-value streak">{user?.streak ?? '-'}</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-label">Energy</span>
                <span className="profile-stat-value points">{user?.energy ?? 0}</span>
              </div>
            </div>
            <div className="profile-actions-row">
              <button className="btn edit-profile" onClick={handleEdit}>Edit Profile</button>
              <button className="btn view-achievements">View Achievements</button>
              <SignOutButton />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
