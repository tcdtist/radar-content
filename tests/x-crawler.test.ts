import { describe, expect, it } from 'vitest';
import { filterActiveTopicUsers } from '../scripts/x-crawler/filter-roster';
import { extractTitleFromTweet, formatTweetToPost } from '../scripts/x-crawler/format-post';
import { XApiClient } from '../scripts/x-crawler/x-api-client';
import { XComment, XTweet, XUser } from '../scripts/x-crawler/types';

describe('X Crawler Engine & Roster Filtering', () => {
  it('filterActiveTopicUsers retains active tech/AI builders and rejects inactive accounts', () => {
    const candidateUsers: XUser[] = [
      {
        id: '1',
        screenName: 'ai_builder',
        name: 'AI Builder',
        description: 'Building autonomous AI agents and LLM orchestration frameworks.',
        followersCount: 5000,
        followingCount: 300,
        statusesCount: 150,
      },
      {
        id: '2',
        screenName: 'cooking_mom',
        name: 'Cooking Lover',
        description: 'Sharing daily homemade recipes and baking tips.',
        followersCount: 12000,
        followingCount: 500,
        statusesCount: 1200,
      },
      {
        id: '3',
        screenName: 'inactive_coder',
        name: 'Ghost Coder',
        description: 'Senior Software Engineer interested in systems and rust.',
        followersCount: 100,
        followingCount: 50,
        statusesCount: 5, // low activity
      },
    ];

    const filtered = filterActiveTopicUsers(candidateUsers);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].screenName).toBe('ai_builder');
    expect(filtered[0].topicTags).toContain('ai');
    expect(filtered[0].topicTags).toContain('agent');
    expect(filtered[0].topicTags).toContain('llm');
  });

  it('extractTitleFromTweet extracts concise first sentence', () => {
    const text =
      'Multi-agent systems will replace monolithic prompts. Instead of cramming 50 instructions, role-based subagents reduce hallucinations.';
    const title = extractTitleFromTweet(text);
    expect(title).toBe('Multi-agent systems will replace monolithic prompts');
  });

  it('formatTweetToPost structures tweet and discussion comments into RawSourcePost', () => {
    const mockTweet: XTweet = {
      id: 'tweet_999',
      text: 'Exploring edge SQLite vs PostgreSQL for agentic state management.',
      author: 'goon_nguyen',
      authorName: 'Duy Nguyen',
      createdAt: 1710000000,
      replyCount: 5,
      retweetCount: 10,
      likeCount: 50,
      url: 'https://x.com/goon_nguyen/status/tweet_999',
      isRetweet: false,
      isReply: false,
    };

    const mockComments: XComment[] = [
      {
        id: 'c1',
        author: 'swyx',
        authorName: 'swyx',
        text: 'The counter-argument is write contention on concurrent agents.',
        likeCount: 25,
        createdAt: 1710001000,
      },
    ];

    const post = formatTweetToPost(mockTweet, mockComments);

    expect(post.source).toBe('x');
    expect(post.sourceId).toBe('tweet_999');
    expect(post.author).toBe('@goon_nguyen');
    expect(post.body).toContain('Duy Nguyen (@goon_nguyen):');
    expect(post.body).toContain('--- Community Discussion & Counterpoints ---');
    expect(post.body).toContain('@swyx (25 likes): The counter-argument is write contention');
    expect(post.engagementScore).toBe(50 + 10 * 2 + 5 * 3); // 85
  });

  it('XApiClient in mock mode retrieves seed profile and tweets without credentials', async () => {
    const client = new XApiClient({ isMock: true });
    const profile = await client.getUserProfile('goon_nguyen');
    expect(profile.screenName).toBe('goon_nguyen');

    const following = await client.getFollowingList(profile, 10);
    expect(following.length).toBeGreaterThan(0);

    const tweets = await client.getUserTweets('goon_nguyen', 2);
    expect(tweets.length).toBeGreaterThan(0);

    const comments = await client.getTweetComments(tweets[0].id);
    expect(comments.length).toBeGreaterThan(0);
  });

  it('parseSeedUsers correctly parses, trims, strips @, and deduplicates user handles', async () => {
    const { parseSeedUsers } = await import('../scripts/x-crawler/filter-roster');
    const input = '  @goon_nguyen, tdinh_me, @karpathy , goon_nguyen, ,  @swyx ';
    const parsed = parseSeedUsers(input);
    expect(parsed).toEqual(['goon_nguyen', 'tdinh_me', 'karpathy', 'swyx']);
  });

  it('deduplicateUsers filters out duplicate accounts case-insensitively while preserving order', async () => {
    const { deduplicateUsers } = await import('../scripts/x-crawler/filter-roster');
    const list: XUser[] = [
      { id: '1', screenName: 'goon_nguyen', name: 'Goon', description: '', followersCount: 1, followingCount: 1, statusesCount: 1 },
      { id: '2', screenName: 'tdinh_me', name: 'Tony', description: '', followersCount: 1, followingCount: 1, statusesCount: 1 },
      { id: '3', screenName: 'GOON_NGUYEN', name: 'Goon Duplicate', description: '', followersCount: 1, followingCount: 1, statusesCount: 1 },
      { id: '4', screenName: 'karpathy', name: 'Andrej', description: '', followersCount: 1, followingCount: 1, statusesCount: 1 },
    ];

    const deduplicated = deduplicateUsers(list);
    expect(deduplicated).toHaveLength(3);
    expect(deduplicated.map((u) => u.screenName)).toEqual(['goon_nguyen', 'tdinh_me', 'karpathy']);
  });

  it('parseCrawlerArgs respects SEED_USERS environment variable and CLI flags', async () => {
    const { parseCrawlerArgs } = await import('../scripts/x-crawler/parse-crawler-args');
    const prevEnv = process.env.SEED_USERS;
    try {
      process.env.SEED_USERS = 'tdinh_me,altryne';
      const optsFromEnv = parseCrawlerArgs([]);
      expect(optsFromEnv.seedUsers).toEqual(['tdinh_me', 'altryne']);
      expect(optsFromEnv.seedUser).toBe('tdinh_me');

      // CLI override flag
      const optsFromCli = parseCrawlerArgs(['--seeds=karpathy,swyx', '--direct-only', '--limit=8']);
      expect(optsFromCli.seedUsers).toEqual(['karpathy', 'swyx']);
      expect(optsFromCli.includeFollowing).toBe(false);
      expect(optsFromCli.includeSeed).toBe(true);
      expect(optsFromCli.limit).toBe(8);
    } finally {
      if (prevEnv) {
        process.env.SEED_USERS = prevEnv;
      } else {
        delete process.env.SEED_USERS;
      }
    }
  });

  it('XApiClient retrieves multiple mock seed users seamlessly', async () => {
    const client = new XApiClient({ isMock: true });
    const profile1 = await client.getUserProfile('tdinh_me');
    const profile2 = await client.getUserProfile('goon_nguyen');
    expect(profile1.screenName).toBe('tdinh_me');
    expect(profile2.screenName).toBe('goon_nguyen');
  });
});
