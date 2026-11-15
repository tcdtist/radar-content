import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureNotifiedClustersTable,
  isClusterNotified,
  isClusterStoryAlreadyNotified,
  markClusterNotified,
  notifyPromotedClusters,
} from '../src/lib/notifications/discord-notifier';
import { sendDiscordClusterAlert } from '../src/lib/notifications/discord-formatter';

describe('Discord Notifier & Anti-Spam Gate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects invalid or missing webhook URLs without executing DB queries', async () => {
    const mockDb = { prepare: vi.fn() } as unknown as D1Database;
    const resEmpty = await notifyPromotedClusters(mockDb, '');
    expect(resEmpty.sentCount).toBe(0);
    expect(resEmpty.reason).toContain('Invalid or missing');

    const resInvalid = await notifyPromotedClusters(mockDb, 'https://example.com/webhook');
    expect(resInvalid.sentCount).toBe(0);
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('ensureNotifiedClustersTable and state tracking correctly track notified clusters', async () => {
    const executedQueries: string[] = [];
    const notifiedSet = new Set<string>();

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        executedQueries.push(sql);
        return {
          run: vi.fn().mockResolvedValue({ success: true }),
          bind: vi.fn().mockImplementation((...params: unknown[]) => ({
            run: vi.fn().mockImplementation(async () => {
              if (params[0]) notifiedSet.add(String(params[0]));
              return { success: true };
            }),
            first: vi.fn().mockImplementation(async () => {
              const id = String(params[0]);
              return notifiedSet.has(id) ? { 1: 1 } : null;
            }),
          })),
        };
      }),
    } as unknown as D1Database;

    await ensureNotifiedClustersTable(mockDb);
    expect(executedQueries.some((q) => q.includes('CREATE TABLE IF NOT EXISTS notified_clusters'))).toBe(true);

    const isNotifiedBefore = await isClusterNotified(mockDb, 'cluster_123');
    expect(isNotifiedBefore).toBe(false);

    await markClusterNotified(mockDb, 'cluster_123');
    const isNotifiedAfter = await isClusterNotified(mockDb, 'cluster_123');
    expect(isNotifiedAfter).toBe(true);
  });

  it('sendDiscordClusterAlert constructs rich embed and dispatches POST request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);

    const cluster = {
      id: 'cluster_ai_1',
      label: 'Agentic Consensus on Edge SQLite',
      score: 85,
      status: 'READY',
      topic_tags: '["AI", "System Design"]',
      article_count: 3,
      source_count: 2,
    };

    const articles = [
      {
        source: 'x' as const,
        url: 'https://x.com/karpathy/status/100',
        title: 'Evaluating consensus on D1',
        author: '@karpathy',
        summary: 'Deep analysis of edge SQLite consensus.',
        evidence: JSON.stringify(['70% latency reduction', 'Zero-idle compute cost']),
        counter: JSON.stringify(['Write contention with 50 concurrent writers']),
      },
    ];

    const webhookUrl = 'https://discord.com/api/webhooks/123/token';
    const ok = await sendDiscordClusterAlert(webhookUrl, cluster, articles);
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe(webhookUrl);
    const body = JSON.parse(callArgs[1].body);
    expect(body.username).toBe('Radar Content Bot');
    expect(body.embeds[0].title).toBe('🎯 [READY] Agentic Consensus on Edge SQLite');
    expect(body.embeds[0].url).toBe('https://radar-content.pages.dev/?card=cluster_ai_1');
    expect(body.embeds[0].fields[0].value).toContain('Score: 85/100');
    expect(body.embeds[0].fields[1].value).toContain('70% latency reduction');
    expect(body.embeds[0].fields[2].value).toContain('Write contention');
    expect(body.embeds[0].fields[3].value).toContain('[X: Evaluating consensus on D1](https://x.com/karpathy/status/100)');
    expect(body.embeds[0].fields[4].value).toContain('[Mở Thẻ Phân Tích Toàn Diện](https://radar-content.pages.dev/?card=cluster_ai_1)');
  });

  it('notifyPromotedClusters enforces anti-spam gates: filters low score, non-T1 sources, and deduplicates', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const dbClusters = [
      {
        id: 'cluster_top',
        label: 'LLM Multi-Agent Orchestration',
        score: 88,
        status: 'READY',
        topic_tags: '["AI"]',
        article_count: 2,
        source_count: 2,
      },
    ];

    const notifiedClusters = new Set<string>();

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        return {
          run: vi.fn().mockResolvedValue({ success: true }),
          bind: vi.fn().mockImplementation((...params: unknown[]) => ({
            all: vi.fn().mockImplementation(async () => {
              if (sql.includes('FROM clusters')) {
                const unnotified = dbClusters.filter((c) => !notifiedClusters.has(c.id));
                return { results: unnotified };
              }
              if (sql.includes('FROM cluster_articles')) {
                return {
                  results: [
                    {
                      source: 'rss',
                      url: 'https://blog.cloudflare.com/workers-ai', // Tier 1 Domain
                      title: 'Workers AI Edge Inference',
                      author: 'Cloudflare',
                      summary: 'Cloudflare announces global serverless AI updates.',
                      evidence: JSON.stringify(['Global rollout across 300 cities']),
                      counter: JSON.stringify(['Cold start latency on larger 70B models']),
                    },
                  ],
                };
              }
              return { results: [] };
            }),
            run: vi.fn().mockImplementation(async () => {
              if (sql.includes('INSERT OR IGNORE INTO notified_clusters')) {
                notifiedClusters.add(String(params[0]));
              }
              return { success: true };
            }),
            first: vi.fn().mockResolvedValue(null),
          })),
        };
      }),
    } as unknown as D1Database;

    const webhookUrl = 'https://discord.com/api/webhooks/123/token';

    // 1st run: Should detect cluster_top and notify Discord
    const res1 = await notifyPromotedClusters(mockDb, webhookUrl);
    expect(res1.sentCount).toBe(1);
    expect(res1.notifiedClusterId).toBe('cluster_top');
    expect(notifiedClusters.has('cluster_top')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 2nd run: Cluster is already in notified_clusters -> Zero spam!
    const res2 = await notifyPromotedClusters(mockDb, webhookUrl);
    expect(res2.sentCount).toBe(0);
    expect(res2.reason).toContain('No new unnotified READY clusters');
    expect(fetchMock).toHaveBeenCalledTimes(1); // Still 1 call, zero repeat spam!
  });

  it('isClusterStoryAlreadyNotified detects duplicate by matching cluster label or lead article URL', async () => {
    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        run: vi.fn().mockResolvedValue({ success: true }),
        bind: vi.fn().mockImplementation((...params: unknown[]) => ({
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes('lower(trim(c.label)) = lower(trim(?))')) {
              // Return match if label matches 'apple · ios, icloud+'
              const targetLabel = String(params[1]).toLowerCase();
              if (targetLabel.includes('apple')) return { 1: 1 };
            }
            if (sql.includes('a.url IN')) {
              // Return match if URL is duplicate
              const urls = params.slice(1).map(String);
              if (urls.includes('https://x.com/AroraBhavyam/status/1')) return { 1: 1 };
            }
            return null;
          }),
        })),
      })),
    } as unknown as D1Database;

    const clusterLabelDup = {
      id: 'cluster_new_apple',
      label: 'Apple · ios, icloud+',
      score: 80,
      status: 'READY',
      topic_tags: '["AI"]',
      article_count: 2,
      source_count: 2,
    };

    const isDupByLabel = await isClusterStoryAlreadyNotified(mockDb, clusterLabelDup, []);
    expect(isDupByLabel).toBe(true);

    const clusterArticleDup = {
      id: 'cluster_new_yc',
      label: 'Bhavyam Arora · entrepreneur first',
      score: 75,
      status: 'READY',
      topic_tags: '["AI"]',
      article_count: 1,
      source_count: 1,
    };

    const dupArticles = [
      {
        source: 'x' as const,
        url: 'https://x.com/AroraBhavyam/status/1',
        title: 'YC W27 closing soon',
        author: '@AroraBhavyam',
        summary: 'YC deadline.',
        evidence: null,
        counter: null,
      },
    ];

    const isDupByArticle = await isClusterStoryAlreadyNotified(mockDb, clusterArticleDup, dupArticles);
    expect(isDupByArticle).toBe(true);

    const freshCluster = {
      id: 'cluster_fresh_linux',
      label: 'Linux Kernel · bcachefs',
      score: 82,
      status: 'READY',
      topic_tags: '["System Design"]',
      article_count: 2,
      source_count: 1,
    };

    const freshArticles = [
      {
        source: 'rss' as const,
        url: 'https://lwn.net/articles/fresh',
        title: 'Bcachefs Updates',
        author: 'Kent Overstreet',
        summary: 'New file system updates.',
        evidence: null,
        counter: null,
      },
    ];

    const isNotDup = await isClusterStoryAlreadyNotified(mockDb, freshCluster, freshArticles);
    expect(isNotDup).toBe(false);
  });

  it('notifyPromotedClusters marks duplicate cluster as notified and skips sending webhook', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const notifiedSet = new Set<string>();

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        run: vi.fn().mockResolvedValue({ success: true }),
        bind: vi.fn().mockImplementation((...params: unknown[]) => ({
          run: vi.fn().mockImplementation(async () => {
            if (sql.includes('INSERT OR IGNORE INTO notified_clusters')) {
              notifiedSet.add(String(params[0]));
            }
            return { success: true };
          }),
          all: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM clusters c')) {
              return {
                results: [
                  {
                    id: 'cluster_dup_candidate',
                    label: 'Y Combinator · paul graham, bhavyam arora',
                    score: 74,
                    status: 'READY',
                    topic_tags: '["AI"]',
                    article_count: 1,
                    source_count: 1,
                  },
                ],
              };
            }
            if (sql.includes('FROM cluster_articles ca')) {
              return {
                results: [
                  {
                    source: 'x',
                    url: 'https://x.com/AroraBhavyam/status/2114733287629619337',
                    title: 'YC W27 applications close in a week',
                    author: '@AroraBhavyam',
                    summary: 'YC deadline.',
                    evidence: JSON.stringify(['2% acceptance rate', '4% unicorn rate']),
                    counter: null,
                  },
                ],
              };
            }
            return { results: [] };
          }),
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes('SELECT count(*) as count FROM notified_clusters')) {
              return { count: 0 };
            }
            if (sql.includes('SELECT 1 FROM cluster_articles ca')) {
              // Simulating that this article was already in a previously notified cluster
              return { 1: 1 };
            }
            return null;
          }),
        })),
      })),
    } as unknown as D1Database;

    const webhookUrl = 'https://discord.com/api/webhooks/123/token';
    const result = await notifyPromotedClusters(mockDb, webhookUrl);

    // Verified: Sent count is 0, zero fetch calls dispatched!
    expect(result.sentCount).toBe(0);
    expect(result.reason).toContain('All candidate clusters were already notified or duplicate stories');
    expect(fetchMock).not.toHaveBeenCalled();

    // The duplicate candidate cluster is recorded as notified to prevent re-querying
    expect(notifiedSet.has('cluster_dup_candidate')).toBe(true);
  });
});
