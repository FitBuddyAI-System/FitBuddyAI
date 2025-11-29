import React, { useEffect, useRef } from 'react';
import { signInWithGoogle, signInWithGoogleCredential } from '../services/authService';
import './SignInPage.css';

declare global {
  interface Window {
    google?: any;
  }
}

function decodeJWT(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

const GoogleIdentityButton: React.FC = () => {
  const divRef = useRef<HTMLDivElement | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const useSupabase = Boolean(import.meta.env.VITE_LOCAL_USE_SUPABASE || import.meta.env.VITE_SUPABASE_URL);

  // If Supabase is available prefer the Supabase OAuth redirect flow. This
  // ensures sessions are created/managed by Supabase rather than doing local
  // ID token verification.
  if (useSupabase) {
    return (
      <div className="google-fallback">
        <button
          className="btn btn-google"
          onClick={async () => {
            try {
              await signInWithGoogle();
            } catch (e) {
              console.warn('[GoogleIdentityButton] signInWithGoogle failed', e);
              window.showFitBuddyNotification?.({ title: 'Sign-in Failed', message: 'Google sign-in failed. Check console for details.', variant: 'error' });
            }
          }}
        >
          <span className="google-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" width="18" height="18" aria-hidden="true">
              <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.4H272v95.5h146.9c-6.3 34.1-25 63-53.4 82.3v68.3h86.4c50.6-46.6 81.6-115.3 81.6-195.7z"/>
              <path fill="#34A853" d="M272 544.3c72.6 0 133.7-24.1 178.2-65.6l-86.4-68.3c-24 16.1-54.9 25.6-91.8 25.6-70.6 0-130.4-47.6-151.8-111.5H29.8v69.9C74.3 486.9 166.3 544.3 272 544.3z"/>
              <path fill="#FBBC05" d="M120.2 325.1c-10.9-32.6-10.9-67.6 0-100.2V155H29.8c-39.6 77.4-39.6 169.4 0 246.8l90.4-76.7z"/>
              <path fill="#EA4335" d="M272 107.7c38.5 0 73 13.2 100.3 39.2l75.1-75.1C405.8 24.7 346.7 0 272 0 166.3 0 74.3 57.4 29.8 143.6l90.4 69.9C141.6 155.3 201.4 107.7 272 107.7z"/>
            </svg>
          </span>
          <span className="google-text">Continue with Google</span>
        </button>
      </div>
    );
  }

  // If client ID is not provided, show a visible fallback so users know why
  // the official Google button didn't render.
  if (!clientId) {
    return (
      <div className="google-fallback">
        <button
          className="btn btn-google"
          onClick={() => window.showFitBuddyNotification?.({ title: 'Sign-in Unavailable', message: 'Google sign-in is not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env and register the OAuth client in Google Cloud Console.', variant: 'warning' })}
        >
          Continue with Google
        </button>
      </div>
    );
  }
  useEffect(() => {
    // Wait for the GSI script to load
    const tryInit = () => {
      if (!clientId) {
        console.warn('[GoogleIdentityButton] VITE_GOOGLE_CLIENT_ID not set in env; GSI button will not initialize.');
        return;
      }
      if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              try {
                const idToken = response?.credential;
                if (!idToken) return;
                const payload = decodeJWT(idToken);
                console.log('[GoogleIdentityButton] GSI credential received, payload:', payload);
                // Send the id_token to the server for verification / session creation
                try {
                  await signInWithGoogleCredential(idToken);
                } catch (e) {
                  console.warn('[GoogleIdentityButton] signInWithGoogleCredential failed', e);
                }
              } catch (e) {
                console.warn('[GoogleIdentityButton] error handling credential', e);
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true
          });
          if (divRef.current) {
            window.google.accounts.id.renderButton(divRef.current, {
              theme: 'outline',
              size: 'large',
              width: '100%'
            });
          }
        } catch (e) {
          console.warn('[GoogleIdentityButton] failed to initialize GSI', e);
        }
      } else {
        // If script hasn't loaded yet, try again shortly
        setTimeout(tryInit, 250);
      }
    };
    tryInit();

    // Cleanup: remove any auto prompt
    return () => {
      try {
        if (window.google && window.google.accounts && window.google.accounts.id && typeof window.google.accounts.id.cancel === 'function') {
          window.google.accounts.id.cancel();
        }
      } catch (e) {}
    };
  }, [clientId]);

  return (
    <div>
      <div ref={divRef} />
      {/* Fallback for environments without GSI script */}
      {!window.google && (
        <div className="google-fallback">
          <button
            className="btn btn-google"
            onClick={() => window.showFitBuddyNotification?.({ title: 'Sign-in Unavailable', message: 'Google sign-in is not available. Try enabling Supabase OAuth or add VITE_GOOGLE_CLIENT_ID to your .env', variant: 'warning' })}
          >
            Continue with Google
          </button>
        </div>
      )}
    </div>
  );
};

export default GoogleIdentityButton;
