import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseTopicParam,
  parseStatusParam,
  parseSortParam,
  parseSearchParam,
  updateUrl,
} from '../src/pages/hooks/url-params';

describe('URL Filter Parameters Parsing & Synchronization', () => {
  let currentUrl = 'http://localhost:3000/';
  let historyState: any = {};

  beforeEach(() => {
    currentUrl = 'http://localhost:3000/';
    historyState = {};
    vi.stubGlobal('window', {
      location: {
        get search() {
          return new URL(currentUrl).search;
        },
        get pathname() {
          return new URL(currentUrl).pathname;
        },
        get hash() {
          return new URL(currentUrl).hash;
        },
        get href() {
          return currentUrl;
        },
      },
      history: {
        get state() {
          return historyState;
        },
        pushState: (state: any, _title: string, url: string) => {
          historyState = state;
          currentUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
        },
        replaceState: (state: any, _title: string, url: string) => {
          historyState = state;
          currentUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
        },
      },
    });
  });

  describe('parseTopicParam', () => {
    it('defaults to all when null, empty, or unknown', () => {
      expect(parseTopicParam(null)).toBe('all');
      expect(parseTopicParam('')).toBe('all');
      expect(parseTopicParam('unknown-topic')).toBe('all');
    });

    it('matches known topics case-insensitively', () => {
      expect(parseTopicParam('AI')).toBe('AI');
      expect(parseTopicParam('ai')).toBe('AI');
      expect(parseTopicParam('Backend')).toBe('Backend');
      expect(parseTopicParam('frontend')).toBe('Frontend');
      expect(parseTopicParam('cloud/devops')).toBe('Cloud/DevOps');
      expect(parseTopicParam('database')).toBe('Database');
      expect(parseTopicParam('Security')).toBe('Security');
      expect(parseTopicParam('System Design')).toBe('System Design');
    });
  });

  describe('parseStatusParam', () => {
    it('defaults to READY,LEAD when null, empty, or invalid', () => {
      expect(parseStatusParam(null)).toBe('READY,LEAD');
      expect(parseStatusParam('')).toBe('READY,LEAD');
      expect(parseStatusParam('INVALID_STATUS')).toBe('READY,LEAD');
    });

    it('parses valid status options', () => {
      expect(parseStatusParam('READY,LEAD')).toBe('READY,LEAD');
      expect(parseStatusParam('READY')).toBe('READY');
      expect(parseStatusParam('SAVED')).toBe('SAVED');
      expect(parseStatusParam('WRITTEN')).toBe('WRITTEN');
      expect(parseStatusParam('DISMISSED')).toBe('DISMISSED');
    });
  });

  describe('parseSortParam', () => {
    it('defaults to score when null, empty, or unknown', () => {
      expect(parseSortParam(null)).toBe('score');
      expect(parseSortParam('')).toBe('score');
      expect(parseSortParam('random')).toBe('score');
    });

    it('parses valid sort options', () => {
      expect(parseSortParam('score')).toBe('score');
      expect(parseSortParam('newest')).toBe('newest');
      expect(parseSortParam('evidence')).toBe('evidence');
    });
  });

  describe('parseSearchParam', () => {
    it('returns empty string when null, undefined, or empty', () => {
      expect(parseSearchParam(null)).toBe('');
      expect(parseSearchParam('')).toBe('');
      expect(parseSearchParam('   ')).toBe('');
    });

    it('trims whitespace from search string', () => {
      expect(parseSearchParam('  rust microservices  ')).toBe('rust microservices');
    });
  });

  describe('Clean URL synchronization for filters', () => {
    it('removes topic when set to all, adds topic when non-default', () => {
      updateUrl((p) => p.set('topic', 'AI'));
      expect(new URLSearchParams(window.location.search).get('topic')).toBe('AI');

      updateUrl((p) => p.delete('topic'));
      expect(new URLSearchParams(window.location.search).has('topic')).toBe(false);
    });

    it('removes status when set to READY,LEAD, adds when non-default', () => {
      updateUrl((p) => p.set('status', 'SAVED'));
      expect(new URLSearchParams(window.location.search).get('status')).toBe('SAVED');

      updateUrl((p) => p.delete('status'));
      expect(new URLSearchParams(window.location.search).has('status')).toBe(false);
    });

    it('removes sort when score, adds when newest or evidence', () => {
      updateUrl((p) => p.set('sort', 'newest'));
      expect(new URLSearchParams(window.location.search).get('sort')).toBe('newest');

      updateUrl((p) => p.delete('sort'));
      expect(new URLSearchParams(window.location.search).has('sort')).toBe(false);
    });

    it('removes q when search query is empty', () => {
      updateUrl((p) => p.set('q', 'cloudflare'), true);
      expect(new URLSearchParams(window.location.search).get('q')).toBe('cloudflare');

      updateUrl((p) => p.delete('q'), true);
      expect(new URLSearchParams(window.location.search).has('q')).toBe(false);
    });
  });
});
