import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SignUpPage.css';
import { signUp } from '../services/authService';

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
      // Use the shared signUp helper which handles client persistence correctly
      await signUp(normalizedEmail, username, password);
      // After signUp, Supabase may require email verification. The shared helper will
      // persist the token only if a session was returned. If no token exists, show the
      // verify page so the UI does not pretend the user is signed in.
      const stored = (() => { try { const s = sessionStorage.getItem('fitbuddyai_user_data'); return s ? JSON.parse(s) : null; } catch { return null; } })();
      if (stored && stored.token) {
        navigate('/profile');
      } else {
        navigate(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
      }
    } catch (err: any) {
      const m = String(err?.message || err || '');
      if (/email already exists|duplicate|23505|An account with that email already exists/i.test(m)) {
        setError('An account with that email already exists. Please sign in or use a different email.');
      } else {
        setError(m || 'Sign up failed');
      }
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
