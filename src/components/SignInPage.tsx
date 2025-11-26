import React, { useState } from 'react';
import { saveAssessmentData, saveWorkoutPlan, saveUserData } from '../services/localStorage';
import { signIn } from '../services/authService';
import GoogleIdentityButton from './GoogleIdentityButton';
import { restoreUserDataFromServer } from '../services/cloudBackupService';
import { useNavigate } from 'react-router-dom';
import './SignInPage.css';
import './EmailVerifyPage.css';

const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendModalOpen, setResendModalOpen] = useState(false);
  const [resendEmail, setResendEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const normalizedEmail = String(email).trim().toLowerCase();
    try {
      const dataUser = await signIn(normalizedEmail, password);
      // The signIn helper will store token and user in localStorage when using Supabase or the server
      const data = dataUser ? { user: dataUser, token: null } : null;
      if (data && data.user) {
      // Use central saveUserData but skip auto-backup for now so we don't overwrite server data
      // before a restore completes. After restore completes, existing scheduleBackup calls
      // (from saving assessment/plan) will run as needed.
        // Save user data and token into the unified user_data object so attachAuthHeaders finds it
  const toSave = { data: data.user, token: data.token || null };
  try { saveUserData(toSave, { skipBackup: true, forceSave: true } as any); } catch {}
        // Wait briefly for sessionStorage token to be available for attachAuthHeaders
        const waitForToken = async (timeoutMs = 2000) => {
          const start = Date.now();
          while (Date.now() - start < timeoutMs) {
            try {
              const { getAuthToken, loadUserData } = await import('../services/localStorage');
              const token = getAuthToken() || (loadUserData()?.token) || (loadUserData()?.data?.token) || null;
              if (token) return token;
            } catch (e) {}
            await new Promise(r => setTimeout(r, 150));
          }
          return null;
        };
        await waitForToken(3000);
        try { sessionStorage.setItem('fitbuddyaiUsername', data.user.username); } catch {}
        // Attempt to restore any server-stored questionnaire/workout/assessment data
        try {
          await restoreUserDataFromServer(data.user.id);
        } catch (err) {
          console.warn('Failed to restore user data from server:', err);
        }
  // Notify other app parts (same-tab) that a login occurred so they can sync state
  try { window.dispatchEvent(new Event('fitbuddyai-login')); } catch (err) {}
        // Fetch consolidated user-data payload (questionnaire, plan, assessment) via POST so we don't rely on GET routing
        try {
          const postUrl = '/api/userdata/load';
          console.log('[SignInPage] POSTing to userdata save endpoint to retrieve stored payload', postUrl);
          const init = await import('../services/apiAuth').then(m => m.attachAuthHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: data.user.id }) }));

          // Helper: attempt the POST multiple times to allow auth token propagation to localStorage
          const doPostWithRetries = async (url: string, initObj: RequestInit, maxAttempts = 3, delayMs = 500) => {
            let lastRes: Response | null = null;
            let lastText: string | null = null;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
              try {
                const r = await fetch(url, initObj);
                const t = await r.text();
                lastRes = r;
                lastText = t;
                if (r.ok) return { res: r, text: t };
                // If 401/403 (auth issue), retry; otherwise only retry for transient 5xx
                if (attempt < maxAttempts && (r.status === 401 || r.status === 403 || (r.status >= 500 && r.status < 600))) {
                  console.warn(`[SignInPage] userdata POST attempt ${attempt} failed status ${r.status}. Retrying after ${delayMs}ms`);
                  await new Promise(r => setTimeout(r, delayMs));
                  continue;
                }
                return { res: r, text: t };
              } catch (e) {
                lastRes = null;
                lastText = null;
                if (attempt < maxAttempts) {
                  console.warn(`[SignInPage] userdata POST attempt ${attempt} threw, retrying after ${delayMs}ms`, e);
                  await new Promise(r => setTimeout(r, delayMs));
                  continue;
                }
                throw e;
              }
            }
            return { res: lastRes, text: lastText };
          };

          const { res: postRes, text } = await doPostWithRetries(postUrl, init, 3, 500);
          if (!postRes) throw new Error('Failed to receive a response from userdata endpoint');
          console.log('[SignInPage] userdata POST response status:', postRes.status, 'ok:', postRes.ok);
          if (text && text.length) console.log('[SignInPage] userdata POST response snippet:', text.slice(0,500));
          const sourceHeader = postRes.headers.get('x-userdata-source');
          if (sourceHeader) console.log('[SignInPage] userdata source header:', sourceHeader);
          if (!postRes.ok) {
            console.warn('[SignInPage] userdata POST returned non-ok status');
            // fallback: try explicit restore via restoreUserDataFromServer which uses attachAuthHeaders internally
            try { await restoreUserDataFromServer(data.user.id); } catch (re) { console.warn('[SignInPage] fallback restore failed:', re); }
          } else {
            let body: any = null;
            try {
              body = text ? JSON.parse(text) : null;
            } catch (e) {
              console.warn('[SignInPage] userdata POST returned invalid JSON; invoking restoreUserDataFromServer fallback', e);
              try { await restoreUserDataFromServer(data.user.id); } catch (re) { console.warn('[SignInPage] fallback restore failed:', re); }
            }

            const payload = body?.stored ?? body?.payload ?? body;
            if (payload) {
              try {
                const assessRaw = payload.assessment_data ?? payload.fitbuddyai_assessment_data;
                const planRaw = payload.workout_plan ?? payload.fitbuddyai_workout_plan;
                // Unwrap if the server returned a wrapper { data, timestamp }
                const assessmentVal = assessRaw?.data ?? assessRaw ?? null;
                const planVal = planRaw?.data ?? planRaw ?? null;
                if (assessmentVal) saveAssessmentData(assessmentVal);
                if (planVal) saveWorkoutPlan(planVal);
              } catch (e) {
                console.warn('Failed to save restored payload values:', e);
              }
            }
          }
        } catch (err) {
          console.warn('Failed to fetch userdata payload via POST:', err);
        }
        navigate('/profile');
      } else {
        throw new Error('Invalid server response.');
      }
    } catch (err: any) {
      // Handle unconfirmed email specially
      if (err && (err.code === 'ERR_EMAIL_UNCONFIRMED' || /Email not confirmed/i.test(err.message || ''))) {
        setError('Your email address is not confirmed. Please check your inbox for the confirmation link.');
        // Open an inline modal to ask user if they'd like to resend
        setResendEmail(normalizedEmail);
        setResendModalOpen(true);
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin-page">
      <form className="signin-form" onSubmit={handleSubmit}>
        <h1>Sign In</h1>
        <label>Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
        </label>
        <label>Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
        <div className="oauth-divider">or</div>
        <GoogleIdentityButton />
        <div className="signup-link">Don't have an account? <span onClick={() => navigate('/signup')}>Sign Up</span></div>
      </form>
      {resendModalOpen && (
        <ResendConfirmModal
          email={resendEmail}
          onClose={() => setResendModalOpen(false)}
          onSent={() => { setResendModalOpen(false); navigate('/verify-email?email=' + encodeURIComponent(resendEmail)); }}
        />
      )}
    </div>
  );
};

function ResendConfirmModal({ email, onClose, onSent }: { email: string; onClose: () => void; onSent: () => void }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const handleResend = async () => {
    setLoading(true);
    setMsg('');
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/auth/v1/recover`;
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(url, { method: 'POST', headers: { apikey: anon || '', 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (res.ok) {
        setMsg('Verification email resent — check your inbox (and spam).');
        onSent();
      } else {
        setMsg('Failed to resend verification email. Please contact support.');
      }
    } catch (e) {
      setMsg('Failed to resend verification email. Please contact support.');
    }
    setLoading(false);
  };
  return (
    <div className="hc-modal-backdrop" role="dialog" aria-modal="true">
      <div className="hc-modal">
        <header className="hc-modal-header">
          <h3>Resend confirmation</h3>
          <button className="btn" onClick={onClose}>Close</button>
        </header>
        <div className="hc-modal-body">
          <p>We can resend the verification email to <strong>{email}</strong>. Would you like to resend it now?</p>
          {msg && <div className="info">{msg}</div>}
          <div className="hc-modal-actions">
            <button className="btn" onClick={onClose} disabled={loading}>Cancel</button>
            <button className="btn btn-primary" onClick={handleResend} disabled={loading}>{loading ? 'Sending...' : 'Resend'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignInPage;
