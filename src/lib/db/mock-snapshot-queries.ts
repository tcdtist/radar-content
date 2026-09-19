import { queryCards } from './cluster-queries';
import { ScoredIntelligenceCard } from './types';

export interface MockSnapshotRecord {
  id: string;
  data: string;
  updated_at: number;
  sync_date: string;
}

/**
 * Retrieve the latest mock cards snapshot from D1
 */
export async function getLatestMockSnapshot(
  db: D1Database
): Promise<{ cards: ScoredIntelligenceCard[]; syncDate: string } | null> {
  try {
    const row = await db
      .prepare('SELECT data, sync_date FROM mock_snapshot ORDER BY updated_at DESC LIMIT 1')
      .first<{ data: string; sync_date: string }>();

    if (!row || !row.data) return null;

    const cards = JSON.parse(row.data) as ScoredIntelligenceCard[];
    if (!Array.isArray(cards) || cards.length === 0) return null;

    return { cards, syncDate: row.sync_date };
  } catch (err) {
    console.error('[MockSnapshot] Failed to get latest snapshot:', err);
    return null;
  }
}

/**
 * Save a snapshot of cards into D1
 */
export async function saveMockSnapshot(
  db: D1Database,
  cards: ScoredIntelligenceCard[],
  syncDate: string
): Promise<void> {
  const json = JSON.stringify(cards);
  await db
    .prepare(
      `INSERT INTO mock_snapshot (id, data, updated_at, sync_date)
       VALUES ('latest', ?, unixepoch(), ?)
       ON CONFLICT(id) DO UPDATE SET
         data = excluded.data,
         updated_at = excluded.updated_at,
         sync_date = excluded.sync_date`
    )
    .bind(json, syncDate)
    .run();
}

/**
 * Extract the top 12 highest-scoring cards from D1 and save to snapshot
 */
export async function syncTop12MockCards(
  db: D1Database,
  forcedDate?: string
): Promise<{ synced: boolean; count: number; syncDate: string }> {
  const dateStr = forcedDate || new Date().toISOString().slice(0, 10);
  const cards = await queryCards(db, {
    limit: 12,
    sort: 'score',
    status: 'READY,LEAD,SAVED,WRITTEN',
  });

  if (!cards || cards.length === 0) {
    return { synced: false, count: 0, syncDate: dateStr };
  }

  const top12 = cards.slice(0, 12);
  await saveMockSnapshot(db, top12, dateStr);

  return { synced: true, count: top12.length, syncDate: dateStr };
}
