import { RawSourcePost, SourceCrawler } from './source-types';

interface RedditPostChild {
  data: {
    id: string;
    title: string;
    selftext?: string;
    url: string;
    permalink: string;
    author: string;
    score: number;
    num_comments: number;
    created_utc: number;
    stickied?: boolean;
    is_self?: boolean;
  };
}

interface RedditListingResponse {
  data?: {
    children?: RedditPostChild[];
  };
}

export const DEFAULT_SUBREDDITS = [
  'LocalLLaMA',
  'ollama',
  'MachineLearning',
  'programming',
] as const;

export class RedditCrawler implements SourceCrawler {
  readonly name = 'RedditCrawler';
  readonly sourceType = 'reddit' as const;

  private subreddits: string[];
  private userAgent: string;

  constructor(
    subreddits: string[] = [...DEFAULT_SUBREDDITS],
    userAgent = 'radar-content/1.0 (+https://github.com/tcdtist/radar-content)'
  ) {
    this.subreddits = subreddits;
    this.userAgent = userAgent;
  }

  async fetchLatest(limitPerSub = 10): Promise<RawSourcePost[]> {
    const results: RawSourcePost[] = [];

    for (const sub of this.subreddits) {
      try {
        const posts = await this.fetchSubreddit(sub, limitPerSub);
        results.push(...posts);
      } catch (err) {
        console.error(`RedditCrawler error fetching r/${sub}:`, err);
      }
    }

    return results;
  }

  async fetchSubreddit(subreddit: string, limit: number): Promise<RawSourcePost[]> {
    const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot.json?limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit API returned status ${response.status} for r/${subreddit}`);
    }

    const data = (await response.json()) as RedditListingResponse;
    const children = data?.data?.children ?? [];

    return children
      .filter((item) => !item.data.stickied)
      .map((item) => this.normalizePost(item.data, subreddit));
  }

  normalizePost(data: RedditPostChild['data'], subreddit: string): RawSourcePost {
    const fullUrl = data.permalink
      ? `https://www.reddit.com${data.permalink}`
      : data.url;

    const bodyText = (data.selftext && data.selftext.trim().length > 0)
      ? data.selftext
      : (data.url && data.url !== fullUrl ? `Linked URL: ${data.url}` : null);

    return {
      source: 'reddit',
      sourceId: `reddit_${data.id}`,
      url: fullUrl,
      title: `[r/${subreddit}] ${data.title}`,
      body: bodyText,
      author: data.author || null,
      publishedAt: data.created_utc ? Math.floor(data.created_utc) : null,
      engagementScore: data.score || 0,
      commentsCount: data.num_comments || 0,
    };
  }
}
