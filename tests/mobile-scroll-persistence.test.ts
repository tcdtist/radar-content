import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSavedDetailScroll,
  saveDetailScroll,
  isMobileDevice,
} from '../src/pages/hooks/useMobileScrollPersistence';

describe('useMobileScrollPersistence Logic', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    vi.stubGlobal('sessionStorage', {
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
    vi.stubGlobal('window', {
      innerWidth: 500,
    });
  });

  it('saves and retrieves detail scroll position correctly', () => {
    saveDetailScroll('cluster_123', 350);
    expect(getSavedDetailScroll('cluster_123')).toBe(350);
  });

  it('returns 0 when no detail scroll position is stored', () => {
    expect(getSavedDetailScroll('non_existent')).toBe(0);
  });

  it('ignores negative scroll values', () => {
    saveDetailScroll('cluster_neg', -50);
    expect(getSavedDetailScroll('cluster_neg')).toBe(0);
  });

  it('detects mobile devices based on width', () => {
    expect(isMobileDevice()).toBe(true);
  });

  it('stores and retrieves home scroll position from sessionStorage', () => {
    sessionStorage.setItem('radar_mobile_scroll_home', '540');
    expect(sessionStorage.getItem('radar_mobile_scroll_home')).toBe('540');
    const restored = parseInt(sessionStorage.getItem('radar_mobile_scroll_home') || '0', 10);
    expect(restored).toBe(540);
  });
});
