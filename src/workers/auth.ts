import { WorkerEnv } from './pipeline';

export const DEFAULT_ALLOWED_EMAILS = ['admin@example.com'];
export const DEFAULT_ADMIN_EMAIL = DEFAULT_ALLOWED_EMAILS[0];

export interface AuthUser {
  email: string;
  name?: string;
  picture?: string;
  role: 'admin' | 'viewer';
}

export interface SessionPayload {
  email: string;
  name?: string;
  picture?: string;
  role: 'admin';
  exp: number;
}

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSessionToken(payload: SessionPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await getHmacKey(secret);
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));

  let binary = '';
  const bytes = new Uint8Array(signatureBytes);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const encodedSignature = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${data}.${encodedSignature}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    const key = await getHmacKey(secret);
    const signatureBinary = atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/'));
    const signatureBytes = new Uint8Array(signatureBinary.length);
    for (let i = 0; i < signatureBinary.length; i++) {
      signatureBytes[i] = signatureBinary.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(data));
    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function verifyGoogleToken(
  token: string,
  clientId?: string
): Promise<{ email: string; name?: string; picture?: string; email_verified: boolean } | null> {
  try {
    // 1. Try as id_token via tokeninfo
    let res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    if (res.ok) {
      const data = (await res.json()) as {
        email?: string;
        aud?: string;
        name?: string;
        picture?: string;
        email_verified?: string | boolean;
      };
      if (clientId?.trim() && data.aud && data.aud !== clientId.trim()) return null;
      if (data.email) {
        return {
          email: data.email.toLowerCase(),
          name: data.name,
          picture: data.picture,
          email_verified: data.email_verified === true || data.email_verified === 'true',
        };
      }
    }

    // 2. Try as access_token via Google userinfo
    res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        email?: string;
        name?: string;
        picture?: string;
        email_verified?: boolean;
      };
      if (data.email) {
        return {
          email: data.email.toLowerCase(),
          name: data.name,
          picture: data.picture,
          email_verified: Boolean(data.email_verified),
        };
      }
    }

    // 3. Fallback: try as access_token via tokeninfo
    res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
    if (res.ok) {
      const data = (await res.json()) as {
        email?: string;
        email_verified?: string | boolean;
        verified_email?: boolean;
      };
      if (data.email) {
        return {
          email: data.email.toLowerCase(),
          email_verified:
            data.email_verified === true ||
            data.email_verified === 'true' ||
            data.verified_email === true,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export const verifyGoogleIdToken = verifyGoogleToken;

export function getAllowedEmails(env: WorkerEnv): string[] {
  const raw = env.ALLOWED_EMAILS || env.ADMIN_EMAIL;
  if (!raw) return DEFAULT_ALLOWED_EMAILS;
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | undefined | null, env: WorkerEnv): boolean {
  if (!email) return false;
  return getAllowedEmails(env).includes(email.trim().toLowerCase());
}

export function getAdminEmail(env: WorkerEnv): string {
  if (env.ADMIN_EMAIL) return env.ADMIN_EMAIL.toLowerCase();
  const allowed = getAllowedEmails(env);
  return allowed.length > 0 ? allowed[0] : DEFAULT_ADMIN_EMAIL.toLowerCase();
}

export function getJwtSecret(env: WorkerEnv): string {
  return env.JWT_SECRET || env.ADMIN_SECRET || 'radar-content-secret-fallback-key-2026';
}
