
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

const ProfilePage: React.FC<ProfilePageProps> = ({ userData, onProfileUpdate, profileVersion }) => {
  const [user, setUser] = useState(userData || getCurrentUser());
  // Remove stats state, always use user for stats
  const [editMode, setEditMode] = useState(false);
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar || '/images/fitbuddy_head.png');
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

  // Keep local `user` in sync when parent provides new `userData` or profileVersion changes
  useEffect(() => {
    const fresh = userData || getCurrentUser();
    setUser(fresh);
    setEditUsername(fresh?.username || '');
    setEditAvatar(fresh?.avatar || '/images/fitbuddy_head.png');
  }, [userData, profileVersion]);

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-card fade-in-bounce">
          <div className="profile-avatar-bg">
            <img
              src="/images/fitbuddy_head.png"
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
    '/images/fitbuddy_head.png',
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
    setEditAvatar(user?.avatar || '/images/fitbuddy_head.png');
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
      // Client-side validation rules
      const MAX_USERNAME = 20;
      const candidate = String(editUsername || '');
      // Disallow only-space names
      if (candidate.trim().length === 0) {
        const msg = 'Username cannot be empty or only spaces.';
        setError(msg);
        try { window.showFitBuddyNotification?.({ title: 'Invalid Username', message: msg, variant: 'error' }); } catch {}
        setSaving(false);
        return;
      }
      if (candidate.length > MAX_USERNAME) {
        const msg = `Username must be ${MAX_USERNAME} characters or fewer.`;
        setError(msg);
        try { window.showFitBuddyNotification?.({ title: 'Invalid Username', message: msg, variant: 'error' }); } catch {}
        setSaving(false);
        return;
      }
      // Disallow zero-width joiners/non-joiners
      if (/\u200C|\u200D/.test(candidate)) {
        const msg = 'Username contains unsupported invisible characters.';
        setError(msg);
        try { window.showFitBuddyNotification?.({ title: 'Invalid Username', message: msg, variant: 'error' }); } catch {}
        setSaving(false);
        return;
      }
      // Disallow double spaces
      if (/ {2,}/.test(candidate)) {
        const msg = 'Username cannot contain consecutive spaces.';
        setError(msg);
        try { window.showFitBuddyNotification?.({ title: 'Invalid Username', message: msg, variant: 'error' }); } catch {}
        setSaving(false);
        return;
      }
      // Only allow letters, numbers, underscore and spaces (letters include Unicode letters)
      const validRe = /^[\p{L}0-9_ ]+$/u;
      if (!validRe.test(candidate)) {
        const msg = 'Username may only contain letters, numbers, underscores, and spaces.';
        setError(msg);
        try { window.showFitBuddyNotification?.({ title: 'Invalid Username', message: msg, variant: 'error' }); } catch {}
        setSaving(false);
        return;
      }
      // Client-side profanity check (best-effort)
      try {
        const leoModule = await import('leo-profanity');
        const leo = (leoModule && (leoModule.default || leoModule)) as any;
        try { leo.loadDictionary(); } catch {}
        if (leo.check && leo.check(candidate)) {
          const msg = 'Username contains inappropriate or banned words.';
          setError(msg);
          try { window.showFitBuddyNotification?.({ title: 'Invalid Username', message: msg, variant: 'error' }); } catch {}
          setSaving(false);
          return;
        }
      } catch (err) {
        // ignore if profanity lib is not available client-side
      }
      const isDev = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV);
      const backendHost = isDev ? (import.meta.env.VITE_DEV_BACKEND || 'http://localhost:3001') : '';
      const updatePath = isDev ? '/api/user/update' : '/api/user?action=update';
      const url = backendHost + updatePath;
      const currentUserId = user?.id || getCurrentUser()?.id || undefined;
      if (!currentUserId) {
        setSaving(false);
        const msg = 'Unable to determine user id. Please sign in and try again.';
        setError(msg);
        try { window.showFitBuddyNotification?.({ title: 'Save Failed', message: msg, variant: 'error' }); } catch {}
        return;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentUserId, username: editUsername, avatar: editAvatar })
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated.user);
        onProfileUpdate(updated.user);
        setEditMode(false);
        try { window.showFitBuddyNotification?.({ title: 'Profile Saved', message: 'Your profile was updated successfully.', variant: 'success' }); } catch {}
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
        // Try to surface server-provided message when available
        let serverMsg = `Server returned ${res.status}`;
        try {
          const errBody = await res.json().catch(() => null);
          serverMsg = errBody?.message || serverMsg;
        } catch (e) {
          // ignore parse errors
        }

        // If this is a client error (4xx), it's a validation/problem we should show
        // and NOT fall back to saving locally (to avoid persisting invalid data).
        if (res.status >= 400 && res.status < 500) {
          try { window.showFitBuddyNotification?.({ title: 'Save Failed', message: serverMsg, variant: 'error' }); } catch {}
          setError(serverMsg);
        } else {
          // For server errors (5xx) or unexpected statuses, fall back to local save
          try { window.showFitBuddyNotification?.({ title: 'Save Failed', message: serverMsg, variant: 'error' }); } catch {}
          const fallbackUser = { ...user, username: editUsername, avatar: editAvatar };
          try { const { saveUserData } = await import('../services/localStorage'); saveUserData({ data: fallbackUser }); } catch {}
          setUser(fallbackUser);
          onProfileUpdate(fallbackUser);
          setEditMode(false);
          // Attempt to update Supabase auth metadata for the current session even when server is unavailable
          try {
            const displayName = fallbackUser?.username;
            if (displayName && supabase && typeof supabase.auth?.updateUser === 'function') {
              await supabase.auth.updateUser({ data: { display_name: displayName, username: displayName } });
            }
          } catch (e) {
            console.warn('[ProfilePage] failed to update supabase user metadata (fallback)', e && (e as any).message || String(e));
          }
          setError('Saved locally (session) — server unavailable.');
          try { window.showFitBuddyNotification?.({ title: 'Saved Locally', message: 'Profile saved locally. Server unavailable.', variant: 'warning' }); } catch {}
        }
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
      // Attempt to update Supabase auth metadata for the current session even on network error
      try {
        const displayName = fallbackUser?.username;
        if (displayName && supabase && typeof supabase.auth?.updateUser === 'function') {
          await supabase.auth.updateUser({ data: { display_name: displayName, username: displayName } });
        }
      } catch (e) {
        console.warn('[ProfilePage] failed to update supabase user metadata (network fallback)', e && (e as any).message || String(e));
      }
      setError('Saved locally (network error).');
      try { window.showFitBuddyNotification?.({ title: 'Saved Locally', message: 'Profile saved locally due to network error.', variant: 'warning' }); } catch {}
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
                const isShopAvatar = shopAvatars.includes(url);
                const ownsAvatar = !isShopAvatar || (Array.isArray(user.inventory) && user.inventory.some((item: any) => item.image === url));
                return (
                  <button
                    key={url}
                    className={`avatar-select-btn${editAvatar === url ? ' selected' : ''}${!ownsAvatar ? ' locked' : ''}`}
                    onClick={() => { if (ownsAvatar) setEditAvatar(url); else navigate('/shop'); }}
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
