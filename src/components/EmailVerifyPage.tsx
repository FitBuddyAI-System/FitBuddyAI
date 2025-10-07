import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './EmailVerifyPage.css';
import { trackVerifyPageView } from '../services/analytics';
import { supabase } from '../services/supabaseClient';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const EmailVerifyPage: React.FC = () => {
  const navigate = useNavigate();
  const q = useQuery();
  const email = q.get('email') || '';
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => { trackVerifyPageView({ email }); }, [email]);

  return (
    <div className="email-verify-page">
      <div className="verify-card">
        <h1>Confirm your email</h1>
        <p>We sent a confirmation link to <strong>{email || 'your email address'}</strong>. Please check your inbox and click the link to finish signing up.</p>
        <p>If you don't see the email, check your spam/junk folder.</p>
        <p>After clicking the link you'll be signed in automatically.</p>
        <div className="verify-actions">
          <button className="btn" onClick={() => navigate('/signin')}>Back to Sign In</button>
          <button className="btn" disabled={resendLoading} onClick={async () => {
            setResendLoading(true);
            setResendMessage('');
            try {
              // Try public recovery endpoint to cause Supabase to resend confirmation.
              const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
              const url = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/auth/v1/recover`;
              const body = JSON.stringify({ email });
              const res = await fetch(url, { method: 'POST', headers: { apikey: anon || '', 'Content-Type': 'application/json' }, body });
              if (res.ok) {
                setResendMessage('Verification email resent — check your inbox (and spam).');
              } else {
                // Fallback: if public call fails, try Supabase client (if available) to send recovery
                try {
                  await supabase.auth.resetPasswordForEmail(email);
                  setResendMessage('Verification email resent — check your inbox (and spam).');
                } catch (e) {
                  setResendMessage('Failed to resend verification email. Contact support.');
                }
              }
            } catch (e) {
              setResendMessage('Failed to resend verification email. Contact support.');
            }
            setResendLoading(false);
          }}>Resend confirmation</button>
        </div>
        {resendMessage && <div className="info">{resendMessage}</div>}
      </div>
    </div>
  );
};

export default EmailVerifyPage;
