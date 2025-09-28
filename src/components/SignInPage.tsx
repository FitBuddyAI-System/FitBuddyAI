import React, { useState } from 'react';
import { saveAssessmentData, saveWorkoutPlan, saveUserData } from '../services/localStorage';
import { restoreUserDataFromServer } from '../services/cloudBackupService';
import { useNavigate } from 'react-router-dom';
import './SignInPage.css';

const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const normalizedEmail = String(email).trim().toLowerCase();
      const res = await fetch('/api/auth?action=signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password })
      });
      // Read response as text, then parse if not empty
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
        const message = data && data.message ? data.message : `Sign in failed. Raw response: ${text}`;
        throw new Error(message);
      }
        if (data && data.user) {
      // Use central saveUserData but skip auto-backup for now so we don't overwrite server data
      // before a restore completes. After restore completes, existing scheduleBackup calls
      // (from saving assessment/plan) will run as needed.
        // Save user data and token into the unified user_data object so attachAuthHeaders finds it
        const toSave = { data: data.user, token: data.token || null };
        saveUserData(toSave, { skipBackup: true });
        // Wait briefly for localStorage to be written and available to attachAuthHeaders
        const waitForToken = async (timeoutMs = 2000) => {
          const start = Date.now();
          while (Date.now() - start < timeoutMs) {
            try {
              const raw = localStorage.getItem('fitbuddy_user_data');
              if (raw) {
                const parsed = JSON.parse(raw);
                const token = parsed?.token ?? parsed?.data?.token ?? null;
                if (token) return token;
              }
            } catch (e) {}
            await new Promise(r => setTimeout(r, 150));
          }
          return null;
        };
        await waitForToken(3000);
        if (data.user.username) {
          localStorage.setItem('fitbuddyUsername', data.user.username);
        }
        // Attempt to restore any server-stored questionnaire/workout/assessment data
        try {
          await restoreUserDataFromServer(data.user.id);
        } catch (err) {
          console.warn('Failed to restore user data from server:', err);
        }
  // Notify other app parts (same-tab) that a login occurred so they can sync state
  try { window.dispatchEvent(new Event('fitbuddy-login')); } catch (err) {}
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
                const assessRaw = payload.fitbuddy_assessment_data;
                const planRaw = payload.fitbuddy_workout_plan;
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
        throw new Error('Invalid server response. Raw response: ' + text);
      }
    } catch (err: any) {
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
        <div className="signup-link">Don't have an account? <span onClick={() => navigate('/signup')}>Sign Up</span></div>
      </form>
    </div>
  );
};

export default SignInPage;
