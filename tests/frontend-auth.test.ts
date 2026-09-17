import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAuthToken,
  getAuthUser,
  isAdmin,
  loginWithGoogleToken,
  loginWithSecret,
  logout,
  onAuthChange,
  setSession,
} from '../src/pages/services/auth';
import { fetchStats } from '../src/pages/services/client';

describe('Frontend Authentication & Role Permissions', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStore[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    });
    vi.restoreAllMocks();
  });

  it('defaults to unauthenticated and non-admin state', () => {
    expect(getAuthToken()).toBeNull();
    expect(getAuthUser()).toBeNull();
    expect(isAdmin()).toBe(false);
  });

  it('recognizes admin only when token exists and role is admin', () => {
    // Missing token
    setSession('', { email: 'admin@example.com', role: 'admin' });
    expect(isAdmin()).toBe(false);

    // Viewer role
    setSession('token-123', { email: 'admin@example.com', role: 'viewer' });
    expect(isAdmin()).toBe(false);

    // Valid admin session
    setSession('token-123', { email: 'admin@example.com', role: 'admin' });
    expect(isAdmin()).toBe(true);
    expect(getAuthToken()).toBe('token-123');
    expect(getAuthUser()?.email).toBe('admin@example.com');
  });


  it('clears session and triggers listener on logout', () => {
    setSession('token-123', { email: 'admin@example.com', role: 'admin' });
    expect(isAdmin()).toBe(true);

    let notifiedUser: unknown = 'init';
    const unsubscribe = onAuthChange((user) => {
      notifiedUser = user;
    });

    logout();
    expect(getAuthToken()).toBeNull();
    expect(getAuthUser()).toBeNull();
    expect(isAdmin()).toBe(false);
    expect(notifiedUser).toBeNull();
    unsubscribe();
  });

  it('fetchStats returns EMPTY_STATS immediately without network fetch when not admin', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const stats = await fetchStats();
    expect(stats.totalArticles).toBe(0);
    expect(stats.totalClusters).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetchStats calls API with Bearer token when admin is authenticated', async () => {
    setSession('admin-jwt-token', { email: 'admin@example.com', role: 'admin' });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        stats: { totalArticles: 42, totalClusters: 5, readyCount: 3, writtenCount: 1 },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const stats = await fetchStats();
    expect(stats.totalArticles).toBe(42);
    expect(mockFetch).toHaveBeenCalled();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/stats');
    expect(options.headers.Authorization).toBe('Bearer admin-jwt-token');
  });

  it('loginWithSecret handles successful login for admin', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        token: 'signed-jwt',
        user: { email: 'admin@example.com', role: 'admin' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await loginWithSecret('valid-secret');
    expect(result.success).toBe(true);
    expect(isAdmin()).toBe(true);
    expect(getAuthToken()).toBe('signed-jwt');
  });

  it('loginWithGoogleToken rejects unauthorized Google email', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        error: 'Tài khoản không có quyền quản trị.',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await loginWithGoogleToken('google-token-from-other-user');
    expect(result.success).toBe(false);
    expect(result.error).toContain('không có quyền quản trị');
    expect(isAdmin()).toBe(false);
  });

  it('fetchAuthConfig retrieves googleClientId from API', async () => {
    const { fetchAuthConfig } = await import('../src/pages/services/auth');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, googleClientId: 'custom-google-id.apps.googleusercontent.com' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const config = await fetchAuthConfig();
    expect(config.googleClientId).toBe('custom-google-id.apps.googleusercontent.com');
  });
});
