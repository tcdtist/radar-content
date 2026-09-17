import { RawSourcePost, SourceCrawler } from './source-types';
import { fetchArticleContent } from './content-reader';

interface LobstersItem {
  short_id: string;
  created_at: string;
  title: string;
  url: string;
  score: number;
  comment_count: number;
  description_plain?: string;
  submitter_user?: string;
  tags?: string[];
  comments_url: string;
}

export class LobstersCrawler implements SourceCrawler {
  readonly name = 'LobstersCrawler';
  readonly sourceType = 'lobsters' as const;

  private baseUrl: string;

  constructor(baseUrl = 'https://lobste.rs') {
    this.baseUrl = baseUrl;
  }

  async fetchLatest(limit = 10): Promise<RawSourcePost[]> {
    try {
      const res = await fetch(`${this.baseUrl}/hottest.json`, {
        headers: {
          'User-Agent': 'radar-content/1.0 (+https://github.com/tcdtist/radar-content)',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Lobste.rs API returned ${res.status}`);
      }

      const items = (await res.json()) as LobstersItem[];
      const slice = Array.isArray(items) ? items.slice(0, limit) : [];
      const posts: RawSourcePost[] = [];

      const BATCH_SIZE = 3;
      for (let i = 0; i < slice.length; i += BATCH_SIZE) {
        const batch = slice.slice(i, i + BATCH_SIZE);
        const batchPosts = await Promise.all(batch.map((item) => this.normalizeItem(item)));
        posts.push(...batchPosts);
      }

      return posts;
    } catch (err) {
      console.error('LobstersCrawler error:', err);
      return [];
    }
  }

  async normalizeItem(item: LobstersItem): Promise<RawSourcePost> {
    const primaryUrl = item.url && item.url.startsWith('http') ? item.url : item.comments_url;
    let bodyText = item.description_plain ? item.description_plain.trim() : '';

    // If external link, read real article markdown content
    if (item.url && item.url.startsWith('http') && !item.url.includes('lobste.rs')) {
      const articleContent = await fetchArticleContent(item.url, { timeoutMs: 5000, maxCharacters: 4000 });
      if (articleContent) {
        bodyText = bodyText ? `Description: ${bodyText}\n\nArticle Content:\n${articleContent}` : articleContent;
      }
    }

    const tagsInfo = item.tags && item.tags.length > 0 ? `Tags: ${item.tags.join(', ')}` : '';
    if (tagsInfo) {
      bodyText = bodyText ? `${tagsInfo}\n\n${bodyText}` : tagsInfo;
    }

    const publishedAt = item.created_at ? Math.floor(new Date(item.created_at).getTime() / 1000) : null;

    return {
      source: 'lobsters',
      sourceId: `lobsters_${item.short_id}`,
      url: primaryUrl,
      title: item.title || 'Untitled Lobste.rs Post',
      body: bodyText.length > 0 ? bodyText.slice(0, 4500) : null,
      author: item.submitter_user || null,
      publishedAt,
      engagementScore: item.score || 0,
      commentsCount: item.comment_count || 0,
    };
  }
}
