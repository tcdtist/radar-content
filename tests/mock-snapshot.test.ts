import { describe, expect, it, vi } from 'vitest';
import {
  getLatestMockSnapshot,
  saveMockSnapshot,
  syncTop12MockCards,
} from '../src/lib/db/mock-snapshot-queries';
import { makeClusterId, ScoredIntelligenceCard } from '../src/lib/db/types';

const sampleCards: ScoredIntelligenceCard[] = [
  {
    id: makeClusterId('test_clu_1'),
    label: 'Test Card 1',
    topic_tags: ['AI'],
    score: 95,
    status: 'READY',
    article_count: 2,
    source_count: 1,
    created_at: 1789700000,
    updated_at: 1789701000,
    summary: 'Test summary 1',
    evidence: ['Evidence 1'],
    counter: ['Counter 1'],
    context: ['Context 1'],
    verification_questions: ['Question 1'],
    entities: ['AI'],
    sources: [],
  },
];

describe('Mock Snapshot Queries', () => {
  it('getLatestMockSnapshot returns parsed cards and sync date', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({
          data: JSON.stringify(sampleCards),
          sync_date: '2026-09-18',
        }),
      }),
    } as unknown as D1Database;

    const result = await getLatestMockSnapshot(mockDb);
    expect(result).not.toBeNull();
    expect(result?.syncDate).toBe('2026-09-18');
    expect(result?.cards).toHaveLength(1);
    expect(result?.cards[0].id).toBe('test_clu_1');
  });

  it('getLatestMockSnapshot returns null when table is empty or error occurs', async () => {
    const emptyDb = {
      prepare: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
      }),
    } as unknown as D1Database;

    const result = await getLatestMockSnapshot(emptyDb);
    expect(result).toBeNull();
  });

  it('saveMockSnapshot executes insert with proper serialized json and date', async () => {
    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockDb = {
      prepare: vi.fn().mockReturnValue({ bind: mockBind }),
    } as unknown as D1Database;

    await saveMockSnapshot(mockDb, sampleCards, '2026-09-18');
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO mock_snapshot'));
    expect(mockBind).toHaveBeenCalledWith(JSON.stringify(sampleCards), '2026-09-18');
    expect(mockRun).toHaveBeenCalled();
  });

  it('syncTop12MockCards syncs top cards and returns sync status', async () => {
    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM clusters')) {
          return {
            bind: () => ({
              all: async () => ({
                results: [
                  {
                    id: 'test_clu_1',
                    label: 'Test Card 1',
                    topic_tags: '["AI"]',
                    score: 95,
                    status: 'READY',
                    article_count: 1,
                    source_count: 1,
                    created_at: 1789700000,
                    updated_at: 1789701000,
                  },
                ],
              }),
            }),
          };
        }
        if (sql.includes('FROM cluster_articles')) {
          return {
            bind: () => ({
              all: async () => ({ results: [] }),
            }),
          };
        }
        return {
          bind: () => ({ run: mockRun }),
        };
      }),
    } as unknown as D1Database;

    const res = await syncTop12MockCards(mockDb, '2026-09-18');
    expect(res.synced).toBe(true);
    expect(res.count).toBe(1);
    expect(res.syncDate).toBe('2026-09-18');
  });
});
