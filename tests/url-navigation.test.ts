import { describe, it, expect, beforeEach, vi } from 'vitest';

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
        pushState: (_state: any, _title: string, url: string) => {
          currentUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
        },
        replaceState: (_state: any, _title: string, url: string) => {
          currentUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
        },
      },
    });
  });

  it('correctly reads card and tab query parameters from window.location', () => {
    currentUrl = 'http://localhost:3000/?card=cluster_comm_25&tab=evidence';

    const params = new URLSearchParams(window.location.search);
    expect(params.get('card')).toBe('cluster_comm_25');
    expect(params.get('tab')).toBe('evidence');
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

  it('replaces tab query parameter when switching detail tabs', () => {
    currentUrl = 'http://localhost:3000/?card=cluster_comm_7&tab=summary';

    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'verify');
    window.history.replaceState({}, '', url.pathname + url.search);

    const currentParams = new URLSearchParams(window.location.search);
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
});
