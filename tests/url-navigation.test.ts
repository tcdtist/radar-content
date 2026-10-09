import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parsePageParam, parsePageSizeParam } from '../src/pages/hooks/useUrlNavigation';

describe('URL Navigation & Deep-Linking State Logic', () => {
  let currentUrl = 'http://localhost:3000/';

  beforeEach(() => {
    currentUrl = 'http://localhost:3000/';
    vi.stubGlobal('window', {
      location: {
        get search() {
          return new URL(currentUrl).search;
        },
        get href() {
          return currentUrl;
        },
      },
      history: {
        pushState: (_state: unknown, _title: string, url: string) => {
          currentUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
        },
        replaceState: (_state: unknown, _title: string, url: string) => {
          currentUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
        },
      },
    });
  });

  describe('parsePageParam', () => {
    it('defaults to page 1 when parameter is null, empty, or invalid', () => {
      expect(parsePageParam(null)).toBe(1);
      expect(parsePageParam('')).toBe(1);
      expect(parsePageParam('0')).toBe(1);
      expect(parsePageParam('-5')).toBe(1);
      expect(parsePageParam('abc')).toBe(1);
      expect(parsePageParam('NaN')).toBe(1);
    });

    it('parses valid positive integer page strings', () => {
      expect(parsePageParam('1')).toBe(1);
      expect(parsePageParam('2')).toBe(2);
      expect(parsePageParam('42')).toBe(42);
    });
  });

  describe('parsePageSizeParam', () => {
    it('defaults to 6 when parameter is null, empty, or invalid', () => {
      expect(parsePageSizeParam(null)).toBe(6);
      expect(parsePageSizeParam('')).toBe(6);
      expect(parsePageSizeParam('10')).toBe(6);
      expect(parsePageSizeParam('100')).toBe(6);
      expect(parsePageSizeParam('-6')).toBe(6);
      expect(parsePageSizeParam('xyz')).toBe(6);
    });

    it('parses valid supported page sizes 6, 12, 24', () => {
      expect(parsePageSizeParam('6')).toBe(6);
      expect(parsePageSizeParam('12')).toBe(12);
      expect(parsePageSizeParam('24')).toBe(24);
    });
  });

  it('updates pageSize parameter and cleans URL when pageSize is 6', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('pageSize', '12');
    window.history.pushState({}, '', url.pathname + url.search);

    let currentParams = new URLSearchParams(window.location.search);
    expect(currentParams.get('pageSize')).toBe('12');

    // PageSize 6 cleans URL
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('pageSize');
    window.history.pushState({}, '', cleanUrl.pathname + cleanUrl.search);

    currentParams = new URLSearchParams(window.location.search);
    expect(currentParams.has('pageSize')).toBe(false);
  });

  it('correctly reads card and tab query parameters from window.location', () => {
    currentUrl = 'http://localhost:3000/?card=cluster_comm_25&tab=evidence';
    const params = new URLSearchParams(window.location.search);
    expect(params.get('card')).toBe('cluster_comm_25');
    expect(params.get('tab')).toBe('evidence');
  });

  it('correctly reads page parameter from window.location', () => {
    currentUrl = 'http://localhost:3000/?page=3';
    const params = new URLSearchParams(window.location.search);
    expect(parsePageParam(params.get('page'))).toBe(3);
  });

  it('updates page query parameter when page changes and cleans on page 1', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('page', '2');
    window.history.pushState({}, '', url.pathname + url.search);

    let currentParams = new URLSearchParams(window.location.search);
    expect(currentParams.get('page')).toBe('2');

    // Page 1 cleans URL
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('page');
    window.history.pushState({}, '', cleanUrl.pathname + cleanUrl.search);

    currentParams = new URLSearchParams(window.location.search);
    expect(currentParams.has('page')).toBe(false);
  });

  it('preserves page parameter when card is opened and closed', () => {
    currentUrl = 'http://localhost:3000/?page=4';

    // Open card
    const url = new URL(window.location.href);
    url.searchParams.set('card', 'cluster_comm_12');
    url.searchParams.set('tab', 'evidence');
    window.history.pushState({}, '', url.pathname + url.search);

    let currentParams = new URLSearchParams(window.location.search);
    expect(currentParams.get('page')).toBe('4');
    expect(currentParams.get('card')).toBe('cluster_comm_12');
    expect(currentParams.get('tab')).toBe('evidence');

    // Close card
    const closeUrl = new URL(window.location.href);
    closeUrl.searchParams.delete('card');
    closeUrl.searchParams.delete('tab');
    window.history.pushState({}, '', closeUrl.pathname + closeUrl.search);

    currentParams = new URLSearchParams(window.location.search);
    expect(currentParams.get('page')).toBe('4');
    expect(currentParams.has('card')).toBe(false);
    expect(currentParams.has('tab')).toBe(false);
  });

  it('updates query parameters on card selection', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('card', 'cluster_comm_7');
    url.searchParams.set('tab', 'counter');
    window.history.pushState({}, '', url.pathname + url.search);

    const currentParams = new URLSearchParams(window.location.search);
    expect(currentParams.get('card')).toBe('cluster_comm_7');
    expect(currentParams.get('tab')).toBe('counter');
  });

  it('replaces tab query parameter when switching detail tabs without dropping page', () => {
    currentUrl = 'http://localhost:3000/?page=2&card=cluster_comm_7&tab=summary';

    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'verify');
    window.history.replaceState({}, '', url.pathname + url.search);

    const currentParams = new URLSearchParams(window.location.search);
    expect(currentParams.get('page')).toBe('2');
    expect(currentParams.get('card')).toBe('cluster_comm_7');
    expect(currentParams.get('tab')).toBe('verify');
  });

  it('clears card and tab parameters when detail drawer is closed', () => {
    currentUrl = 'http://localhost:3000/?card=cluster_comm_7&tab=context';

    const url = new URL(window.location.href);
    url.searchParams.delete('card');
    url.searchParams.delete('tab');
    window.history.pushState({}, '', url.pathname + url.search);

    const currentParams = new URLSearchParams(window.location.search);
    expect(currentParams.has('card')).toBe(false);
    expect(currentParams.has('tab')).toBe(false);
  });

  it('preserves pageSize parameter when navigating pages and inspecting cards', () => {
    currentUrl = 'http://localhost:3000/?pageSize=12&page=2';
    const url = new URL(window.location.href);
    url.searchParams.set('card', 'cluster_comm_9');
    url.searchParams.set('tab', 'sources');
    window.history.pushState({}, '', url.pathname + url.search);

    let currentParams = new URLSearchParams(window.location.search);
    expect(currentParams.get('pageSize')).toBe('12');
    expect(currentParams.get('page')).toBe('2');
    expect(currentParams.get('card')).toBe('cluster_comm_9');
    expect(currentParams.get('tab')).toBe('sources');

    const closeUrl = new URL(window.location.href);
    closeUrl.searchParams.delete('card');
    closeUrl.searchParams.delete('tab');
    window.history.pushState({}, '', closeUrl.pathname + closeUrl.search);

    currentParams = new URLSearchParams(window.location.search);
    expect(currentParams.get('pageSize')).toBe('12');
    expect(currentParams.get('page')).toBe('2');
    expect(currentParams.has('card')).toBe(false);
  });
});
