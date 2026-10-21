import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyPromotedClusters } from '../src/lib/notifications/discord-notifier';

describe('Discord Notifier Translation & Deep-Link Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('translates cluster details into Vietnamese on-the-fly and sends 100% Vietnamese alert', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);

    const savedTranslations: Array<{ card_id: string; summary: string }> = [];

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        run: vi.fn().mockResolvedValue({ success: true }),
        bind: vi.fn().mockImplementation((...params: unknown[]) => ({
          run: vi.fn().mockImplementation(async () => {
            if (sql.includes('INSERT INTO card_translations')) {
              savedTranslations.push({
                card_id: String(params[0]),
                summary: String(params[2]),
              });
            }
            return { success: true };
          }),
          all: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM clusters')) {
              return {
                results: [
                  {
                    id: 'cluster_vn_test',
                    label: 'DeepSeek · vLLM, latency',
                    score: 92,
                    status: 'READY',
                    topic_tags: '["AI"]',
                    article_count: 2,
                    source_count: 2,
                  },
                ],
              };
            }
            if (sql.includes('FROM cluster_articles')) {
              return {
                results: [
                  {
                    source: 'x',
                    url: 'https://x.com/deepseek/status/1',
                    title: 'DeepSeek V3 Inference Optimization',
                    author: '@deepseek',
                    summary: 'Breakthrough optimization on vLLM reducing latency by 45%.',
                    evidence: JSON.stringify(['45% latency reduction', 'Throughput reaching 120 tokens/s']),
                    counter: JSON.stringify(['High VRAM consumption during peak concurrency']),
                  },
                ],
              };
            }
            return { results: [] };
          }),
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM card_translations')) {
              return null; // No cached translation initially
            }
            return null;
          }),
        })),
      })),
    } as unknown as D1Database;

    const translateMock = vi.fn().mockResolvedValue({
      summary: 'Tối ưu hóa đột phá trên vLLM giúp giảm độ trễ 45% cho mô hình DeepSeek.',
      evidence: ['Giảm 45% độ trễ', 'Thông lượng đạt 120 tokens/s'],
      counter: ['Tiêu thụ VRAM cao khi lượng người dùng đồng thời đạt đỉnh'],
      context: ['Cạnh tranh trực tiếp với Claude 3.7 và GPT-4o'],
      verification_questions: ['Kiểm tra benchmark trên phần cứng H100 hay A100?'],
    });

    const webhookUrl = 'https://discord.com/api/webhooks/999/token';
    const result = await notifyPromotedClusters(mockDb, webhookUrl, {
      minScore: 70,
      translateFn: translateMock,
    });

    expect(result.sentCount).toBe(1);
    expect(result.notifiedClusterId).toBe('cluster_vn_test');
    expect(translateMock).toHaveBeenCalledTimes(1);

    // Verify translation was persisted to D1
    expect(savedTranslations.length).toBe(1);
    expect(savedTranslations[0].card_id).toBe('cluster_vn_test');
    expect(savedTranslations[0].summary).toContain('Tối ưu hóa đột phá trên vLLM');

    // Verify Discord POST body contains Vietnamese
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const postBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const embed = postBody.embeds[0];

    expect(embed.title).toBe('🎯 [READY] DeepSeek · vLLM, latency');
    expect(embed.url).toBe('https://radar-content.pages.dev/?card=cluster_vn_test');
    expect(embed.description).toBe('Tối ưu hóa đột phá trên vLLM giúp giảm độ trễ 45% cho mô hình DeepSeek.');
    expect(embed.fields[1].name).toBe('🔍 Bằng Chứng Thực Nghiệm');
    expect(embed.fields[1].value).toContain('Giảm 45% độ trễ');
    expect(embed.fields[2].name).toBe('⚡ Góc Nhìn Phản Biện');
    expect(embed.fields[2].value).toContain('Tiêu thụ VRAM cao khi lượng người dùng đồng thời đạt đỉnh');
    expect(embed.fields[3].name).toBe('🌐 Nguồn Thảo Luận');
    expect(embed.fields[3].value).toContain('https://x.com/deepseek/status/1');
    expect(embed.fields[4].name).toBe('🔗 Chi Tiết Radar Content');
    expect(embed.fields[4].value).toContain('[Mở Thẻ Phân Tích Toàn Diện](https://radar-content.pages.dev/?card=cluster_vn_test)');
  });

  it('reuses cached Vietnamese translation when available in D1 without calling translateFn', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        run: vi.fn().mockResolvedValue({ success: true }),
        bind: vi.fn().mockImplementation(() => ({
          run: vi.fn().mockResolvedValue({ success: true }),
          all: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM clusters')) {
              return {
                results: [
                  {
                    id: 'cluster_cached_1',
                    label: 'Anthropic MCP · tool calling',
                    score: 95,
                    status: 'READY',
                    topic_tags: '["AI"]',
                    article_count: 1,
                    source_count: 1,
                  },
                ],
              };
            }
            if (sql.includes('FROM cluster_articles')) {
              return {
                results: [
                  {
                    source: 'rss',
                    url: 'https://anthropic.com/news/mcp',
                    title: 'Model Context Protocol Announced',
                    author: 'Anthropic',
                    summary: 'Standardized open protocol for AI context.',
                    evidence: JSON.stringify(['Over 50 partners integrated']),
                    counter: JSON.stringify(['Security sandbox limitations']),
                  },
                ],
              };
            }
            return { results: [] };
          }),
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM card_translations')) {
              return {
                card_id: 'cluster_cached_1',
                lang: 'vi',
                summary: 'Giao thức ngữ cảnh mở chuẩn hóa cho AI kết nối công cụ.',
                evidence: JSON.stringify(['Hơn 50 đối tác tích hợp']),
                counter: JSON.stringify(['Giới hạn sandbox bảo mật']),
                context: '[]',
                verification_questions: '[]',
                translated_at: 1790000000,
              };
            }
            return null;
          }),
        })),
      })),
    } as unknown as D1Database;

    const translateMock = vi.fn();
    const webhookUrl = 'https://discord.com/api/webhooks/999/token';

    const result = await notifyPromotedClusters(mockDb, webhookUrl, {
      minScore: 70,
      translateFn: translateMock,
    });

    expect(result.sentCount).toBe(1);
    expect(translateMock).not.toHaveBeenCalled(); // 0 calls to LLM because cache hit!

    const postBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const embed = postBody.embeds[0];
    expect(embed.description).toBe('Giao thức ngữ cảnh mở chuẩn hóa cho AI kết nối công cụ.');
    expect(embed.fields[1].value).toContain('Hơn 50 đối tác tích hợp');
  });
});
