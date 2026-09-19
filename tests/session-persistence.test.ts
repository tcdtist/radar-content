import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkSession, getAuthToken, getAuthUser, isAdmin, setSession } from '../src/pages/services/auth';
import { fetchCards } from '../src/pages/services/client';
import { MOCK_INTELLIGENCE_CARDS } from '../src/lib/data/mock-cards';

describe('Session Persistence & Feed Data Loading', () => {
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

  it('checkSession retains session and admin role upon page reload when token is valid', async () => {
    setSession('persisted-token', { email: 'admin@example.com', role: 'admin' });
    expect(isAdmin()).toBe(true);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        authenticated: true,
        user: { email: 'admin@example.com', role: 'admin' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const isValid = await checkSession();
    expect(isValid).toBe(true);
    expect(isAdmin()).toBe(true);
    expect(getAuthToken()).toBe('persisted-token');
    expect(getAuthUser()?.email).toBe('admin@example.com');
  });

  it('checkSession safely logs out if server returns 401 unauthenticated', async () => {
    setSession('stale-token', { email: 'admin@example.com', role: 'admin' });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, authenticated: false }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const isValid = await checkSession();
    expect(isValid).toBe(false);
    expect(isAdmin()).toBe(false);
    expect(getAuthToken()).toBeNull();
  });

  it('fetchCards passes Authorization Bearer token when admin session is active', async () => {
    setSession('active-admin-jwt', { email: 'admin@example.com', role: 'admin' });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, cards: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchCards({ topic: 'all' });
    expect(mockFetch).toHaveBeenCalled();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/cards');
    expect(options.headers.Authorization).toBe('Bearer active-admin-jwt');
  });

  it('fetchCards omits Authorization header for guest preview', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, cards: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchCards({ topic: 'all' });
    expect(mockFetch).toHaveBeenCalled();
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('mock cards have timestamps >= September 10, 2026', () => {
    const MIN_DATE_TIMESTAMP = 1788998400; // 2026-09-10T00:00:00Z
    expect(MOCK_INTELLIGENCE_CARDS.length).toBe(12);
    MOCK_INTELLIGENCE_CARDS.forEach((card) => {
      expect(card.created_at).toBeGreaterThanOrEqual(MIN_DATE_TIMESTAMP);
    });
  });
});
