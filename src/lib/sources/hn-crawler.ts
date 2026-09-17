import { RawSourcePost, SourceCrawler } from './source-types';
import { fetchArticleContent } from './content-reader';

interface HnItem {
  id: number;
  deleted?: boolean;
  type?: string;
  by?: string;
  time?: number;
  text?: string;
  dead?: boolean;
  parent?: number;
  kids?: number[];
  url?: string;
  score?: number;
  title?: string;
  descendants?: number;
}

export class HackerNewsCrawler implements SourceCrawler {
  readonly name = 'HackerNewsCrawler';
  readonly sourceType = 'hn' as const;

  private baseUrl: string;
  private algoliaUrl: string;

  constructor(
    baseUrl = 'https://hacker-news.firebaseio.com/v0',
    algoliaUrl = 'https://hn.algolia.com/api/v1'
  ) {
    this.baseUrl = baseUrl;
    this.algoliaUrl = algoliaUrl;
  }

  async fetchLatest(limit = 10): Promise<RawSourcePost[]> {
    try {
      // 1. Try Algolia Search for high-signal AI discussions
      const algoliaPosts = await this.fetchAlgoliaAiStories(limit);
      if (algoliaPosts.length > 0) {
        return algoliaPosts;
      }
    } catch (err) {
      console.warn('Algolia HN fetch failed, falling back to Firebase topstories:', err);
    }

    // 2. Fallback to Firebase topstories
    try {
      const topStoryIds = await this.fetchTopStoryIds(limit);
      const postPromises = topStoryIds.map((id) => this.fetchItem(id));
      const items = await Promise.all(postPromises);

      return items
        .filter((item): item is HnItem => item !== null && !item.deleted && !item.dead)
        .map((item) => this.normalizeItem(item));
    } catch (err) {
      console.error('HackerNewsCrawler error:', err);
      return [];
    }
  }

  async fetchAlgoliaAiStories(limit: number): Promise<RawSourcePost[]> {
    const query = 'DeepSeek OR Claude OR "coding agent" OR vLLM OR benchmark OR LLM';
    const url = `${this.algoliaUrl}/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Algolia status: ${res.status}`);

    const data = (await res.json()) as {
      hits?: Array<{
        objectID: string;
        title: string;
        url?: string;
        author?: string;
        created_at_i?: number;
        points?: number;
        num_comments?: number;
        story_text?: string;
      }>;
    };

    const hits = data?.hits ?? [];
    const posts: RawSourcePost[] = [];

    for (const h of hits) {
      const hnDiscussionUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
      const primaryUrl = h.url || hnDiscussionUrl;
      let bodyText = h.story_text ? h.story_text.replace(/<[^>]+>/g, ' ') : '';

      // Ingest real article content from external links if available
      if (h.url && !h.url.includes('news.ycombinator.com')) {
        const articleMd = await fetchArticleContent(h.url, { timeoutMs: 5000, maxCharacters: 4000 });
        if (articleMd) {
          bodyText = `Article Body:\n${articleMd}\n\n${bodyText}`;
        }
      }

      // Fetch top comments to capture real community benchmarks and counterpoints
      try {
        const itemRes = await fetch(`${this.algoliaUrl}/items/${h.objectID}`);
        if (itemRes.ok) {
          const itemData = (await itemRes.json()) as {
            children?: Array<{ author?: string; text?: string }>;
          };
          const comments = (itemData.children || [])
            .slice(0, 3)
            .map((c) => {
              const cleaned = (c.text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              return cleaned.length > 0 ? `- @${c.author || 'user'}: ${cleaned.slice(0, 300)}` : null;
            })
            .filter((c): c is string => c !== null);

          if (comments.length > 0) {
            bodyText = bodyText
              ? `${bodyText}\n\nTop Community Arguments:\n${comments.join('\n')}`
              : `Top Community Arguments:\n${comments.join('\n')}`;
          }
        }
      } catch {
        // Continue if comments fail
      }

      posts.push({
        source: 'hn',
        sourceId: `hn_${h.objectID}`,
        url: primaryUrl,
        title: h.title || 'Untitled HN Post',
        body: bodyText.length > 0 ? bodyText.slice(0, 3500) : null,
        author: h.author || null,
        publishedAt: h.created_at_i || null,
        engagementScore: h.points || 0,
        commentsCount: h.num_comments || 0,
      });
    }

    return posts;
  }

  async fetchTopStoryIds(limit: number): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/topstories.json`);
    if (!res.ok) {
      throw new Error(`HN API error fetching topstories: ${res.status}`);
    }
    const ids = (await res.json()) as number[];
    return Array.isArray(ids) ? ids.slice(0, limit) : [];
  }

  async fetchItem(id: number): Promise<HnItem | null> {
    try {
      const res = await fetch(`${this.baseUrl}/item/${id}.json`);
      if (!res.ok) return null;
      return (await res.json()) as HnItem;
    } catch {
      return null;
    }
  }

  normalizeItem(item: HnItem): RawSourcePost {
    const hnDiscussionUrl = `https://news.ycombinator.com/item?id=${item.id}`;
    const primaryUrl = item.url || hnDiscussionUrl;

    let bodyText = item.text || null;
    if (item.url && item.url !== hnDiscussionUrl) {
      bodyText = bodyText
        ? `${bodyText}\n\nExternal URL: ${item.url}`
        : `External URL: ${item.url} (HN discussion: ${hnDiscussionUrl})`;
    }

    return {
      source: 'hn',
      sourceId: `hn_${item.id}`,
      url: primaryUrl,
      title: item.title || 'Untitled HN Post',
      body: bodyText,
      author: item.by || null,
      publishedAt: item.time || null,
      engagementScore: item.score || 0,
      commentsCount: item.descendants || 0,
    };
  }
}
