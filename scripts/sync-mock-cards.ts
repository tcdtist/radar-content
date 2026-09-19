import fs from 'fs';
import path from 'path';
import { ScoredIntelligenceCard } from '../src/lib/db/types';

/**
 * Formats a single ScoredIntelligenceCard into compact, type-safe TypeScript code.
 * Ensures the output is strictly < 25 lines per card to guarantee file length < 200 lines.
 */
function formatCard(c: ScoredIntelligenceCard): string {
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
    sources: ${JSON.stringify(c.sources.slice(0, 2))},
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

    const cards = data.cards.slice(0, 12);
    console.log(`[SyncMock] Retrieved ${cards.length} cards successfully.`);

    // Partition into categories
    const aiList = cards.filter((c) =>
      c.topic_tags.some((t) => {
        const lower = t.toLowerCase();
        return lower.includes('ai') || lower.includes('llm') || lower.includes('agent');
      })
    );
    const feList = cards.filter(
      (c) =>
        !aiList.includes(c) &&
        c.topic_tags.some((t) => {
          const lower = t.toLowerCase();
          return ['frontend', 'ui', 'css', 'web', 'tooling'].some((k) => lower.includes(k));
        })
    );
    const sysList = cards.filter((c) => !aiList.includes(c) && !feList.includes(c));

    // Fill buckets to exactly 4 cards if pool allows
    const pool = [...cards];
    const takeUpTo4 = (bucket: ScoredIntelligenceCard[]): ScoredIntelligenceCard[] => {
      const result = bucket.slice(0, 4);
      for (const item of pool) {
        if (result.length >= 4) break;
        if (!result.includes(item)) result.push(item);
      }
      return result;
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

    serializeFile('mock-cards-ai.ts', 'MOCK_AI_CARDS', takeUpTo4(aiList));
    serializeFile('mock-cards-system.ts', 'MOCK_SYSTEM_CARDS', takeUpTo4(sysList));
    serializeFile('mock-cards-frontend.ts', 'MOCK_FRONTEND_CARDS', takeUpTo4(feList));

    console.log('[SyncMock] All mock cards updated successfully.');
  } catch (err) {
    console.error('[SyncMock] Sync failed with error:', err);
  }
}

syncMockCards();
