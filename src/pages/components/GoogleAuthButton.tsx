import React, { useEffect, useState } from 'react';
import { fetchAuthConfig } from '../services/auth';
import { BaseButton } from './BaseButton';
import { GoogleIcon } from './Icons';

interface GoogleAuthButtonProps {
  onLogin: (token: string) => Promise<{ success: boolean; error?: string }>;
}

function loadGsiScript(onLoaded: () => void) {
  if (typeof window === 'undefined') return;
  if (window.google?.accounts?.oauth2) return onLoaded();
  const existing = document.getElementById('google-gsi-client');
  if (existing) {
    existing.addEventListener('load', onLoaded);
    return;
  }
  const script = document.createElement('script');
  script.id = 'google-gsi-client';
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.onload = onLoaded;
  document.head.appendChild(script);
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [clientId, setClientId] = useState<string>(() => {
    return (
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      '933682594054-pmetb580h3obbfs9h2mmkjika1j04fb9.apps.googleusercontent.com'
    );
  });

  useEffect(() => {
    if (!clientId) {
      fetchAuthConfig().then((cfg) => {
        if (cfg.googleClientId) setClientId(cfg.googleClientId);
      });
    }
    loadGsiScript(() => {});
  }, [clientId]);

  const handleGoogleSignIn = () => {
    if (!clientId) {
      alert('Google Client ID is not configured.');
      return;
    }

    loadGsiScript(() => {
      if (!window.google?.accounts?.oauth2) {
        alert('Loading Google identity services, please retry in a moment.');
        return;
      }

      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile openid',
          callback: async (res) => {
            if (res.error) {
              setIsLoading(false);
              console.warn('[Google Auth] OAuth error:', res.error);
              return;
            }
            if (res.access_token) {
              setIsLoading(true);
              const loginRes = await onLogin(res.access_token);
              setIsLoading(false);
              if (!loginRes.success) {
                alert(loginRes.error || 'Google sign-in failed');
              }
            }
          },
        });

        client.requestAccessToken({ prompt: 'select_account' });
      } catch (err) {
        setIsLoading(false);
        console.error('[Google Auth] Request token error:', err);
      }
    });
  };

  return (
    <BaseButton
      id="btn-google-login"
      variant="ghost"
      size="md"
      onClick={handleGoogleSignIn}
      isLoading={isLoading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      <GoogleIcon size={14} />
      <span>Google Sign In</span>
    </BaseButton>
  );
};
