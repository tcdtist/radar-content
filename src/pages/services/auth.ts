export interface AuthUser {
  email: string;
  name?: string;
  picture?: string;
  role: 'admin' | 'viewer';
}

const STORAGE_TOKEN_KEY = 'radar_auth_token';
const STORAGE_USER_KEY = 'radar_auth_user';

const API_BASE =
  import.meta.env.VITE_API_URL ||
  '/api';

type AuthListener = (user: AuthUser | null) => void;
const listeners: Set<AuthListener> = new Set();

function notifyListeners(user: AuthUser | null) {
  listeners.forEach((fn) => {
    try {
      fn(user);
    } catch (err) {
      console.error('[Auth] Listener callback error:', err);
    }
  });
}

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return null;
}

export function getAuthToken(): string | null {
  const storage = getStorage();
  return storage ? storage.getItem(STORAGE_TOKEN_KEY) : null;
}

export function getAuthUser(): AuthUser | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(STORAGE_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isAdmin(): boolean {
  const user = getAuthUser();
  const token = getAuthToken();
  return Boolean(
    token &&
    user &&
    user.role === 'admin'
  );
}

export function setSession(token: string, user: AuthUser): void {
  const storage = getStorage();
  if (storage) {
    storage.setItem(STORAGE_TOKEN_KEY, token);
    storage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  }
  notifyListeners(user);
}

export function logout(): void {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(STORAGE_TOKEN_KEY);
    storage.removeItem(STORAGE_USER_KEY);
  }
  notifyListeners(null);
}

export function onAuthChange(callback: AuthListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export async function fetchAuthConfig(): Promise<{ googleClientId: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/config`);
    if (!res.ok) return { googleClientId: '' };
    const data = (await res.json()) as { success: boolean; googleClientId?: string };
    return { googleClientId: data.googleClientId || '' };
  } catch {
    return { googleClientId: '' };
  }
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = (await res.json()) as {
      success: boolean;
      token?: string;
      user?: AuthUser;
      error?: string;
    };
    if (!res.ok || !data.success || !data.token || !data.user) {
      return { success: false, error: data.error || `Login failed (HTTP ${res.status})` };
    }

    setSession(data.token, data.user);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error during login';
    return { success: false, error: message };
  }
}

export function loginWithSecret(secret: string): Promise<{ success: boolean; error?: string }> {
  return loginWithEmail('', secret);
}

export async function loginWithGoogleToken(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data = await res.json() as { success: boolean; token?: string; user?: AuthUser; error?: string };
    if (!res.ok || !data.success || !data.token || !data.user) {
      return { success: false, error: data.error || `Google authentication failed (HTTP ${res.status})` };
    }

    setSession(data.token, data.user);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error during Google login';
    return { success: false, error: message };
  }
}

export async function checkSession(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) {
    logout();
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      logout();
      return false;
    }
    const data = (await res.json()) as { success?: boolean; authenticated?: boolean; user?: AuthUser };
    if ((data.success || data.authenticated) && data.user) {
      setSession(token, data.user);
      return true;
    }
    logout();
    return false;
  } catch {
    // If offline or network glitch, keep local cache unless 401
    return isAdmin();
  }
}
