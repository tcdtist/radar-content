import { describe, expect, it } from 'vitest';
import { RedditCrawler } from '../src/lib/sources/reddit-crawler';
import { HackerNewsCrawler } from '../src/lib/sources/hn-crawler';
import { CrawlerRegistry } from '../src/lib/sources/crawler-registry';

describe('RedditCrawler', () => {
  it('normalizes reddit post data correctly', () => {
    const crawler = new RedditCrawler(['LocalLLaMA']);
    const normalized = crawler.normalizePost(
      {
        id: 'abc123',
        title: 'DeepSeek-V3 Benchmark on 4x RTX 4090',
        selftext: 'We ran 1000 tokens/sec benchmark...',
        url: 'https://reddit.com/r/LocalLLaMA/comments/abc123/deepseek_v3/',
        permalink: '/r/LocalLLaMA/comments/abc123/deepseek_v3/',
        author: 'ai_researcher',
        score: 350,
        num_comments: 85,
        created_utc: 1710000000,
      },
      'LocalLLaMA'
    );

    expect(normalized.source).toBe('reddit');
    expect(normalized.sourceId).toBe('reddit_abc123');
    expect(normalized.title).toBe('[r/LocalLLaMA] DeepSeek-V3 Benchmark on 4x RTX 4090');
    expect(normalized.body).toContain('1000 tokens/sec');
    expect(normalized.engagementScore).toBe(350);
    expect(normalized.commentsCount).toBe(85);
    expect(normalized.publishedAt).toBe(1710000000);
  });
});

describe('HackerNewsCrawler', () => {
  it('normalizes external link HN story correctly', () => {
    const crawler = new HackerNewsCrawler();
    const normalized = crawler.normalizeItem({
      id: 998877,
      title: 'SQLite in the Cloud: Architecture Deep Dive',
      url: 'https://blog.example.com/sqlite-cloud',
      by: 'dang',
      score: 412,
      descendants: 120,
      time: 1710005000,
    });

    expect(normalized.source).toBe('hn');
    expect(normalized.sourceId).toBe('hn_998877');
    expect(normalized.title).toBe('SQLite in the Cloud: Architecture Deep Dive');
    expect(normalized.url).toBe('https://blog.example.com/sqlite-cloud');
    expect(normalized.body).toContain('External URL: https://blog.example.com/sqlite-cloud');
    expect(normalized.engagementScore).toBe(412);
  });
});

describe('CrawlerRegistry', () => {
  it('initializes default crawlers', () => {
    const registry = new CrawlerRegistry();
    const crawlers = registry.getCrawlers();
    expect(crawlers.length).toBe(4);
    expect(crawlers.map((c) => c.name)).toEqual([
      'RssCrawler',
      'HackerNewsCrawler',
      'LobstersCrawler',
      'RedditCrawler',
    ]);
  });
});

describe('RssCrawler', () => {
  it('parses Atom XML feed items correctly', async () => {
    const { RssCrawler } = await import('../src/lib/sources/rss-crawler');
    const crawler = new RssCrawler([]);
    const sampleXml = `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>DeepSeek V4 Routing Analysis</title>
          <link href="https://example.com/deepseek-v4-route" />
          <summary>Analysis of 12.1M redirected queries to Opus...</summary>
          <published>2026-09-15T12:00:00Z</published>
        </entry>
      </feed>
    `;

    const items = crawler.parseXmlItems(sampleXml);

    expect(items.length).toBe(1);
    expect(items[0].title).toBe('DeepSeek V4 Routing Analysis');
    expect(items[0].url).toBe('https://example.com/deepseek-v4-route');
    expect(items[0].description).toContain('12.1M redirected queries');
  });
});
