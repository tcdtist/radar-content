import { describe, expect, it } from 'vitest';
import {
  getAuthorityWeight,
  getSourceTier,
  HIGH_AUTHORITY_DOMAINS,
  isStructurallyDeep,
  SourceTier,
} from '../src/lib/scoring/source-tiers';

describe('Source Tiers', () => {
  describe('getSourceTier', () => {
    it('returns T1 for X source', () => {
      const config = getSourceTier('x');
      expect(config.tier).toBe(SourceTier.T1_AUTHORITY);
      expect(config.weight).toBe(1.0);
    });

    it('returns T2 for Hacker News source', () => {
      const config = getSourceTier('hn');
      expect(config.tier).toBe(SourceTier.T2_DEPTH);
      expect(config.weight).toBe(0.75);
    });

    it('returns T2 for Lobsters source', () => {
      const config = getSourceTier('lobsters');
      expect(config.tier).toBe(SourceTier.T2_DEPTH);
    });

    it('returns T3 for Reddit source', () => {
      const config = getSourceTier('reddit');
      expect(config.tier).toBe(SourceTier.T3_REFERENCE);
      expect(config.weight).toBe(0.4);
    });

    it('returns T3 for generic RSS feed', () => {
      const config = getSourceTier('rss', 'https://techcrunch.com/feed/');
      expect(config.tier).toBe(SourceTier.T3_REFERENCE);
    });

    it('elevates RSS to T1 for Anthropic blog', () => {
      const config = getSourceTier('rss', 'https://www.anthropic.com/feed');
      expect(config.tier).toBe(SourceTier.T1_AUTHORITY);
      expect(config.weight).toBe(1.0);
    });

    it('elevates RSS to T1 for Cloudflare blog', () => {
      const config = getSourceTier('rss', 'https://blog.cloudflare.com/rss/');
      expect(config.tier).toBe(SourceTier.T1_AUTHORITY);
    });

    it('elevates RSS to T1 for Simon Willison blog', () => {
      const config = getSourceTier('rss', 'https://simonwillison.net/atom/everything/');
      expect(config.tier).toBe(SourceTier.T1_AUTHORITY);
    });

    it('elevates RSS to T2 for Vercel blog', () => {
      const config = getSourceTier('rss', 'https://vercel.com/atom');
      expect(config.tier).toBe(SourceTier.T2_DEPTH);
    });

    it('elevates RSS to T2 for GitHub releases atom', () => {
      const config = getSourceTier('rss', 'https://github.com/oven-sh/bun/releases.atom');
      expect(config.tier).toBe(SourceTier.T2_DEPTH);
    });

    it('returns T3 for RSS with no feed URL', () => {
      const config = getSourceTier('rss');
      expect(config.tier).toBe(SourceTier.T3_REFERENCE);
    });

    it('returns T3 for RSS with invalid URL', () => {
      const config = getSourceTier('rss', 'not-a-url');
      expect(config.tier).toBe(SourceTier.T3_REFERENCE);
    });

    it('rejects spoofed domain names (anti-spoofing)', () => {
      expect(getSourceTier('rss', 'https://evil-anthropic.com/feed').tier).toBe(SourceTier.T3_REFERENCE);
      expect(getSourceTier('rss', 'https://attacker-openai.com/rss').tier).toBe(SourceTier.T3_REFERENCE);
      expect(getSourceTier('rss', 'https://fake-deepseek.com/feed').tier).toBe(SourceTier.T3_REFERENCE);
      expect(getSourceTier('rss', 'https://openai.com.attacker.org/feed').tier).toBe(SourceTier.T3_REFERENCE);
    });
  });

  describe('getAuthorityWeight', () => {
    it('returns 1.0 for X source', () => {
      expect(getAuthorityWeight('x')).toBe(1.0);
    });

    it('returns 0.75 for HN source', () => {
      expect(getAuthorityWeight('hn')).toBe(0.75);
    });

    it('returns 0.4 for Reddit source', () => {
      expect(getAuthorityWeight('reddit')).toBe(0.4);
    });

    it('returns 1.0 for authority RSS (OpenAI)', () => {
      expect(getAuthorityWeight('rss', 'https://openai.com/blog/rss.xml')).toBe(1.0);
    });

    it('returns 0.75 for elevated RSS (Supabase)', () => {
      expect(getAuthorityWeight('rss', 'https://supabase.com/blog/rss.xml')).toBe(0.75);
    });
  });

  describe('HIGH_AUTHORITY_DOMAINS', () => {
    it('contains key AI lab domains', () => {
      expect(HIGH_AUTHORITY_DOMAINS).toContain('anthropic.com');
      expect(HIGH_AUTHORITY_DOMAINS).toContain('openai.com');
      expect(HIGH_AUTHORITY_DOMAINS).toContain('deepseek.com');
    });
  });

  describe('isStructurallyDeep', () => {
    it('returns false for empty text', () => {
      expect(isStructurallyDeep('')).toBe(false);
    });

    it('returns false for short text', () => {
      expect(isStructurallyDeep('hello world')).toBe(false);
    });

    it('returns false for single signal only (keyword but short)', () => {
      expect(isStructurallyDeep('The benchmark results are impressive for this model')).toBe(false);
    });

    it('returns true for text with keyword + hard link', () => {
      const text = 'The benchmark results show 2x throughput improvement. See details at https://arxiv.org/abs/2026.12345';
      expect(isStructurallyDeep(text)).toBe(true);
    });

    it('returns true for long text with technical keywords', () => {
      const text = 'a'.repeat(801) + ' The architecture uses distributed inference with CUDA kernels for maximum throughput across the cluster.';
      expect(isStructurallyDeep(text)).toBe(true);
    });

    it('returns true for text with hard link + long form', () => {
      const text = 'a'.repeat(801) + ' Check the implementation at https://github.com/example/repo for full details.';
      expect(isStructurallyDeep(text)).toBe(true);
    });

    it('returns false for long but non-technical text', () => {
      const text = 'a'.repeat(801) + ' This is a great article about cooking recipes and travel tips.';
      expect(isStructurallyDeep(text)).toBe(false);
    });
  });
});
