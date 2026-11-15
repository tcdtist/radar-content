import fs from 'fs';
import path from 'path';
import { makeClusterId, ScoredIntelligenceCard } from '../src/lib/db/types';

const FALLBACK_CARDS: ScoredIntelligenceCard[] = [
  {
    id: makeClusterId('clu_mock_08_tanstack_query_v5'),
    label: 'TanStack Query v5 + Web Worker Cache: Tối Ưu Phản Hồi Cho Realtime Feed',
    topic_tags: ['Frontend', 'Backend'],
    score: 89,
    status: 'READY',
    article_count: 3,
    source_count: 2,
    created_at: 1794571200,
    updated_at: 1794744000,
    summary: 'Chiến lược tích hợp Web Worker làm lớp đệm cache ngoại vi cho TanStack Query v5 giúp giải phóng 100% chi phí serialization trên main UI thread khi xử lý hàng nghìn records.',
    evidence: [
      'Giảm hiện tượng giật khung hình từ 14% xuống 0% trong các đợt cập nhật dữ liệu realtime lớn.',
      'Tốc độ render biểu đồ radar và bảng tin tức tăng 3.8 lần trên các thiết bị di động tầm trung.',
    ],
    counter: [
      'Phức tạp hóa luồng quản lý state khi cần chia sẻ phiên đăng nhập giữa worker và UI.',
    ],
    context: ['Ứng dụng web hướng dữ liệu đang chuyển dịch tác vụ nặng sang Web Workers.'],
    verification_questions: [
      'Cách xử lý kết nối SSE hoặc WebSockets trực tiếp trong SharedWorker?',
    ],
    entities: ['TanStack Query', 'Web Worker', 'Performance'],
    sources: [
      {
        title: 'Offloading Query Cache to Web Workers in TanStack Query v5',
        url: 'https://news.ycombinator.com/item?id=42420003',
        source: 'hn',
        author: 'tkdodo',
        published_at: 1794571200,
        crawled_at: 1794571250,
      },
    ],
  },
  {
    id: makeClusterId('clu_mock_09_shadcn_tailwind_v4'),
    label: 'Tailwind CSS v4 & CSS Variables Theming: Loại Bỏ Hoàn Toàn JS Runtime Overhead',
    topic_tags: ['Frontend', 'System Design'],
    score: 88,
    status: 'READY',
    article_count: 3,
    source_count: 2,
    created_at: 1794571200,
    updated_at: 1794744000,
    summary: 'Engine Oxide viết bằng Rust trong Tailwind CSS v4 kết hợp chuẩn CSS Variables native giúp giảm 100% kích thước JS theming bundle và biên dịch CSS nhanh gấp 10 lần.',
    evidence: [
      'Thời gian build CSS dự án quy mô lớn giảm từ 2.4 giây xuống còn 180 mili-giây với Rust Oxide compiler.',
      'Chuyển đổi giao diện Sáng/Tối không gây reflow hoặc repaint toàn bộ DOM tree.',
    ],
    counter: [
      'Cú pháp CSS thuần mới trong Tailwind v4 yêu cầu cập nhật lại toàn bộ plugin bên thứ ba.',
    ],
    context: ['Các hệ thống thiết kế hiện đại đang chuyển dịch sang Native CSS Custom Properties.'],
    verification_questions: [
      'Làm thế nào để migrate cấu hình Tailwind v3 sang file CSS duy nhất trong v4?',
    ],
    entities: ['Tailwind CSS v4', 'Rust Oxide', 'CSS Variables'],
    sources: [
      {
        title: 'Tailwind CSS v4.0: A high-performance engine for the modern web',
        url: 'https://news.ycombinator.com/item?id=42380004',
        source: 'hn',
        author: 'adamwathan',
        published_at: 1794571200,
        crawled_at: 1794571250,
      },
    ],
  },
];

/**
 * Formats a single ScoredIntelligenceCard into compact, type-safe TypeScript code.
 * Ensures the output is strictly < 25 lines per card to guarantee file length < 200 lines.
 */
function formatCard(c: ScoredIntelligenceCard): string {
  const seenUrls = new Set<string>();
  const uniqueSources = (c.sources || []).filter((s) => {
    const key = s.url || s.title || `${s.source}_${s.author}`;
    if (seenUrls.has(key)) return false;
    seenUrls.add(key);
    return true;
  });

  return `  {
    id: makeClusterId(${JSON.stringify(c.id)}),
    label: ${JSON.stringify(c.label)},
    topic_tags: ${JSON.stringify(c.topic_tags)},
    score: ${c.score},
    status: ${JSON.stringify(c.status)},
    article_count: ${c.article_count},
    source_count: ${c.source_count},
    created_at: ${c.created_at},
    updated_at: ${c.updated_at},
    summary: ${JSON.stringify(c.summary)},
    evidence: ${JSON.stringify(c.evidence.slice(0, 3))},
    counter: ${JSON.stringify(c.counter.slice(0, 2))},
    context: ${JSON.stringify(c.context.slice(0, 1))},
    verification_questions: ${JSON.stringify(c.verification_questions.slice(0, 2))},
    entities: ${JSON.stringify(c.entities || [])},
    sources: ${JSON.stringify(uniqueSources.slice(0, 2))},
  }`;
}


/**
 * Script to synchronize top-12 highest-scoring cards from the live Worker API
 * into static TypeScript files under src/lib/data/
 */
async function syncMockCards(): Promise<void> {
  const apiUrl =
    process.env.RADAR_API_URL || 'http://localhost:8787/api/cards';
  console.log(`[SyncMock] Fetching top 12 cards from ${apiUrl}...`);

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[SyncMock] Request returned HTTP ${res.status}. Aborting.`);
      return;
    }

    const data = (await res.json()) as {
      success: boolean;
      cards?: ScoredIntelligenceCard[];
    };
    if (!data.success || !Array.isArray(data.cards) || data.cards.length === 0) {
      console.warn('[SyncMock] No cards returned from API. Aborting.');
      return;
    }

    const rawCards = (data.cards || []);
    console.log(`[SyncMock] Retrieved ${rawCards.length} raw cards from API.`);

    const seenIds = new Set<string>();
    const seenLabels = new Set<string>();
    const uniqueCards: ScoredIntelligenceCard[] = [];

    const normalizeLabel = (l: string) =>
      l.toLowerCase().split(/[·,]/).map((s) => s.trim()).filter(Boolean).sort().join('|');

    for (const c of rawCards) {
      const labelKey = normalizeLabel(c.label || '');
      if (seenIds.has(c.id) || (labelKey && seenLabels.has(labelKey))) continue;
      seenIds.add(c.id);
      if (labelKey) seenLabels.add(labelKey);
      uniqueCards.push(c);
    }

    // Backfill up to 12 if API returns fewer than 12 unique topics
    for (const fb of FALLBACK_CARDS) {
      if (uniqueCards.length >= 12) break;
      const labelKey = normalizeLabel(fb.label || '');
      if (!seenIds.has(fb.id) && !seenLabels.has(labelKey)) {
        seenIds.add(fb.id);
        if (labelKey) seenLabels.add(labelKey);
        uniqueCards.push(fb);
      }
    }

    // Partition into categories
    const aiCandidates = uniqueCards.filter((c) =>
      c.topic_tags.some((t) => {
        const lower = t.toLowerCase();
        return lower.includes('ai') || lower.includes('llm') || lower.includes('agent');
      })
    );
    const feCandidates = uniqueCards.filter(
      (c) =>
        !aiCandidates.includes(c) &&
        c.topic_tags.some((t) => {
          const lower = t.toLowerCase();
          return ['frontend', 'ui', 'css', 'web', 'tooling'].some((k) => lower.includes(k));
        })
    );
    const sysCandidates = uniqueCards.filter((c) => !aiCandidates.includes(c) && !feCandidates.includes(c));

    // Fill buckets to exactly 4 distinct cards without cross-bucket duplication
    const assignedIds = new Set<string>();
    const allocateCards = (candidates: ScoredIntelligenceCard[], max = 4): ScoredIntelligenceCard[] => {
      const bucket: ScoredIntelligenceCard[] = [];
      for (const item of candidates) {
        if (bucket.length >= max) break;
        if (!assignedIds.has(item.id)) {
          bucket.push(item);
          assignedIds.add(item.id);
        }
      }
      for (const item of uniqueCards) {
        if (bucket.length >= max) break;
        if (!assignedIds.has(item.id)) {
          bucket.push(item);
          assignedIds.add(item.id);
        }
      }
      return bucket;
    };

    const targetDir = path.resolve(__dirname, '../src/lib/data');

    const serializeFile = (
      filename: string,
      exportName: string,
      items: ScoredIntelligenceCard[]
    ) => {
      const cardsCode = items.map(formatCard).join(',\n');
      const content = `import { makeClusterId, ScoredIntelligenceCard } from '../db/types';\n\nexport const ${exportName}: ScoredIntelligenceCard[] = [\n${cardsCode},\n];\n`;
      fs.writeFileSync(path.join(targetDir, filename), content, 'utf-8');
      console.log(`[SyncMock] Wrote ${items.length} cards to ${filename}`);
    };

    serializeFile('mock-cards-ai.ts', 'MOCK_AI_CARDS', allocateCards(aiCandidates, 4));
    serializeFile('mock-cards-system.ts', 'MOCK_SYSTEM_CARDS', allocateCards(sysCandidates, 4));
    serializeFile('mock-cards-frontend.ts', 'MOCK_FRONTEND_CARDS', allocateCards(feCandidates, 4));

    console.log('[SyncMock] All mock cards updated successfully.');
  } catch (err) {
    console.error('[SyncMock] Sync failed with error:', err);
  }
}

syncMockCards();
