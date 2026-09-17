import { describe, expect, it, vi } from 'vitest';
import { fetchArticleContent } from '../src/lib/sources/content-reader';
import { LobstersCrawler } from '../src/lib/sources/lobsters-crawler';

describe('Content Reader (Jina Reader)', () => {
  it('rejects invalid or non-http URLs', async () => {
    const res1 = await fetchArticleContent('');
    const res2 = await fetchArticleContent('ftp://example.com/file');
    expect(res1).toBeNull();
    expect(res2).toBeNull();
  });

  it('skips reader for discussion index links', async () => {
    const res = await fetchArticleContent('https://news.ycombinator.com/item?id=123');
    expect(res).toBeNull();
  });

  it('blocks private and local network IP addresses to prevent SSRF', async () => {
    expect(await fetchArticleContent('http://localhost/admin')).toBeNull();
    expect(await fetchArticleContent('http://127.0.0.1:8080/metrics')).toBeNull();
    expect(await fetchArticleContent('http://169.254.169.254/metadata')).toBeNull();
    expect(await fetchArticleContent('http://192.168.1.1/secret')).toBeNull();
  });

  it('returns clean markdown when fetch succeeds', async () => {
    const mockMarkdown = `# DeepSeek V4 Benchmark Results\n\nSpeed measured at 169 tokens/sec on 8x H100 GPUs with vLLM.\n\nCost was $1.03 per 45M tokens.`;
    
    // Mock global fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockMarkdown,
    } as unknown as Response);

    const result = await fetchArticleContent('https://tech-blog.example.com/deepseek-eval');

    expect(result).toContain('DeepSeek V4 Benchmark Results');
    expect(result).toContain('169 tokens/sec');
    expect(result).toContain('$1.03 per 45M tokens');

    globalThis.fetch = originalFetch;
  });

  it('handles Jina error responses gracefully without throwing', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    } as unknown as Response);

    const result = await fetchArticleContent('https://example.com/non-existent');
    expect(result).toBeNull();

    globalThis.fetch = originalFetch;
  });
});

describe('LobstersCrawler', () => {
  it('normalizes Lobste.rs story item with tags and comments', async () => {
    const crawler = new LobstersCrawler();
    const normalized = await crawler.normalizeItem({
      short_id: 'abc890',
      created_at: '2026-09-15T10:00:00.000Z',
      title: 'Building a High-Throughput Token Router in Zig',
      url: 'https://lobste.rs/s/abc890/token_router_zig',
      score: 48,
      comment_count: 14,
      description_plain: 'Discussion on zero-copy serialization in token routers.',
      submitter_user: 'zig_dev',
      tags: ['zig', 'ai', 'performance'],
      comments_url: 'https://lobste.rs/s/abc890',
    });

    expect(normalized.source).toBe('lobsters');
    expect(normalized.sourceId).toBe('lobsters_abc890');
    expect(normalized.title).toBe('Building a High-Throughput Token Router in Zig');
    expect(normalized.engagementScore).toBe(48);
    expect(normalized.commentsCount).toBe(14);
    expect(normalized.body).toContain('Tags: zig, ai, performance');
    expect(normalized.author).toBe('zig_dev');
  });
});
