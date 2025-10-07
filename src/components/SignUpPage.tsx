import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SignUpPage.css';
import { signUp } from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { saveUserData } from '../services/localStorage';

const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const normalizedEmail = String(email).trim().toLowerCase();
      // Prefer Supabase auth if client is configured
      const useSupabase = Boolean(import.meta.env.VITE_LOCAL_USE_SUPABASE || import.meta.env.VITE_SUPABASE_URL);
      if (useSupabase && supabase) {
        const result = await supabase.auth.signUp({ email: normalizedEmail, password, options: { data: { username, energy: 100 } } });
        if (result.error) {
          // Supabase returns errors for duplicate emails; map to user-friendly message
          const msg = result.error.message || String(result.error);
          if (/duplicate|already exists|user exists|email exists/i.test(msg)) {
            throw new Error('An account with that email already exists. Please sign in or use a different email.');
          }
          throw new Error(msg || 'Sign up failed');
        }
        // If Supabase returned a session, persist token so attachAuthHeaders can use it
        const token = result.data?.session?.access_token ?? null;
        const user = result.data?.user ?? null;
        if (user) {
          const toSave = { data: { id: user.id, email: user.email, username: (user.user_metadata && user.user_metadata.username) || username, energy: (user.user_metadata && user.user_metadata.energy) || 100 }, token };
          try { sessionStorage.removeItem('fitbuddy_no_auto_restore'); } catch {}
          try { localStorage.removeItem('fitbuddy_no_auto_restore'); } catch {}
          try { saveUserData(toSave, { skipBackup: true, forceSave: true } as any); } catch { /* ignore */ }
        }
        // If session/token exists navigate directly; otherwise show the "check your email" screen
        if (token) {
          navigate('/profile');
        } else {
          // Show verify page with email query so the user sees which email to check
          navigate(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
        }
      } else {
        try {
          await signUp(normalizedEmail, username, password);
          navigate('/signin');
        } catch (e: any) {
          const m = String(e?.message || e || '');
          if (/email already exists|duplicate|23505/i.test(m)) {
            setError('An account with that email already exists. Please sign in or use a different email.');
          } else {
            setError(m || 'Sign up failed');
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <form className="signup-form" onSubmit={handleSubmit}>
        <h1>Sign Up</h1>
        <label>Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label>Username
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
        </label>
        <label>Confirm Password
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn" type="submit" disabled={loading}>{loading ? 'Signing up...' : 'Sign Up'}</button>
        <div className="signin-link">Already have an account? <span onClick={() => navigate('/signin')}>Sign In</span></div>
      </form>
    </div>
  );
};

export default SignUpPage;
