import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SignUpPage.css';

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
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, username, password })
      });
      const text = await res.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error('Server returned invalid JSON: ' + text);
        }
      }
      if (!res.ok) {
        let message = 'Sign up failed.';
        if (data && data.message) {
          message = data.message;
        } else if (!text) {
          message = 'Sign up failed. No response from server. Is the server running?';
        } else {
          message = `Sign up failed. Raw response: ${text}`;
        }
        throw new Error(message);
      }
      navigate('/signin');
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
