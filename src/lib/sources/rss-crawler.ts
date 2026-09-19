import { RawSourcePost, SourceCrawler } from './source-types';
import { fetchArticleContent } from './content-reader';
import { CURATED_TECH_FEEDS, RssFeedConfig } from './rss-feed-registry';

interface ParsedFeedItem {
  title: string;
  url: string;
  description: string;
  publishedAt: number | null;
  guid: string;
}

export class RssCrawler implements SourceCrawler {
  readonly name = 'RssCrawler';
  readonly sourceType = 'rss' as const;

  private feeds: readonly RssFeedConfig[];

  constructor(feeds: readonly RssFeedConfig[] = CURATED_TECH_FEEDS) {
    this.feeds = feeds;
  }

  async fetchLatest(limitPerFeed = 4): Promise<RawSourcePost[]> {
    const results: RawSourcePost[] = [];

    for (const feed of this.feeds) {
      try {
        const posts = await this.fetchFeed(feed, limitPerFeed);
        results.push(...posts);
      } catch (err) {
        console.error(`RssCrawler error for ${feed.name}:`, err);
      }
    }

    return results;
  }

  async fetchFeed(feed: RssFeedConfig, limit: number): Promise<RawSourcePost[]> {
    const res = await fetch(feed.url, {
      headers: {
        'User-Agent': 'radar-content/1.0 (+https://github.com/tcdtist/radar-content)',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!res.ok) {
      throw new Error(`Feed fetch error: ${res.status} for ${feed.url}`);
    }

    const xml = await res.text();
    const items = this.parseXmlItems(xml).slice(0, limit);
    const posts: RawSourcePost[] = [];

    const BATCH_SIZE = 3;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchPosts = await Promise.all(
        batch.map(async (item) => {
          let bodyText = item.description;

          // If description is brief, fetch rich markdown via content reader
          if (bodyText.length < 400 && item.url.startsWith('http')) {
            const deepContent = await fetchArticleContent(item.url, { timeoutMs: 5000, maxCharacters: 4000 });
            if (deepContent) {
              bodyText = deepContent;
            }
          }

          return {
            source: 'rss' as const,
            sourceId: `rss_${this.hashId(item.guid || item.url)}`,
            url: item.url,
            title: `[${feed.name}] ${item.title}`,
            body: bodyText.length > 0 ? bodyText.slice(0, 4500) : null,
            author: feed.name,
            publishedAt: item.publishedAt,
            engagementScore: 100, // Curated editorial source default score
            commentsCount: 0,
          };
        })
      );
      posts.push(...batchPosts);
    }

    return posts;
  }

  parseXmlItems(xml: string): ParsedFeedItem[] {
    const items: ParsedFeedItem[] = [];
    // Match both RSS <item> and Atom <entry>
    const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];

      // Title
      const titleMatch = /<title[^>]*>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/title>/is.exec(block);
      const title = (titleMatch ? (titleMatch[1] || titleMatch[2] || '') : '').trim();

      // Link (RSS <link>url</link> or Atom <link href="url"/>)
      let link = '';
      const linkTagMatch = /<link[^>]*href=["']([^"']+)["']/i.exec(block);
      if (linkTagMatch) {
        link = linkTagMatch[1];
      } else {
        const linkTextMatch = /<link[^>]*>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/link>/is.exec(block);
        if (linkTextMatch) link = (linkTextMatch[1] || linkTextMatch[2] || '').trim();
      }

      // Description / Summary / Content
      const descMatch = /<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/(?:description|summary|content)>/is.exec(block);
      const rawDesc = descMatch ? (descMatch[1] || descMatch[2] || '') : '';
      const cleanDesc = rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      // Date
      const dateMatch = /<(?:pubDate|published|updated)>(.*?)<\/(?:pubDate|published|updated)>/i.exec(block);
      let publishedAt: number | null = null;
      if (dateMatch) {
        const parsed = Date.parse(dateMatch[1]);
        if (!isNaN(parsed)) publishedAt = Math.floor(parsed / 1000);
      }

      if (title && link) {
        items.push({
          title,
          url: link,
          description: cleanDesc,
          publishedAt,
          guid: link,
        });
      }
    }

    return items;
  }

  private hashId(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
