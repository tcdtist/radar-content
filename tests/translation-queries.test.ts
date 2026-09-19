import { describe, expect, it, vi } from 'vitest';
import { getCardTranslation, saveCardTranslation } from '../src/lib/db/translation-queries';
import { makeClusterId } from '../src/lib/db/types';

describe('Translation Queries (D1 Cache)', () => {
  it('fetches existing card translation and parses json fields correctly', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            card_id: 'cluster_test_1',
            lang: 'vi',
            summary: 'Tóm tắt tiếng Việt mẫu.',
            evidence: JSON.stringify(['Bằng chứng 1', 'Bằng chứng 2']),
            counter: JSON.stringify(['Phản biện 1']),
            context: JSON.stringify(['Ngữ cảnh 1']),
            verification_questions: JSON.stringify(['Câu hỏi 1']),
            translated_at: 1789700000,
          }),
        }),
      }),
    } as unknown as D1Database;

    const result = await getCardTranslation(mockDb, makeClusterId('cluster_test_1'), 'vi');

    expect(result).not.toBeNull();
    expect(result?.card_id).toBe('cluster_test_1');
    expect(result?.summary).toBe('Tóm tắt tiếng Việt mẫu.');
    expect(result?.evidence).toEqual(['Bằng chứng 1', 'Bằng chứng 2']);
    expect(result?.counter).toEqual(['Phản biện 1']);
    expect(result?.context).toEqual(['Ngữ cảnh 1']);
    expect(result?.verification_questions).toEqual(['Câu hỏi 1']);
  });

  it('returns null if translation is not found in cache', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      }),
    } as unknown as D1Database;

    const result = await getCardTranslation(mockDb, makeClusterId('cluster_non_existent'), 'vi');
    expect(result).toBeNull();
  });

  it('saves card translation into D1 cache with upsert query', async () => {
    let executedSql = '';
    const boundParams: unknown[] = [];

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        executedSql = sql;
        return {
          bind: vi.fn().mockImplementation((...params: unknown[]) => {
            boundParams.push(...params);
            return {
              run: vi.fn().mockResolvedValue({ success: true }),
            };
          }),
        };
      }),
    } as unknown as D1Database;

    const success = await saveCardTranslation(mockDb, {
      card_id: makeClusterId('cluster_test_save'),
      lang: 'vi',
      summary: 'Tóm tắt lưu thành công.',
      evidence: ['Bằng chứng A'],
      counter: ['Phản biện B'],
      context: ['Ngữ cảnh C'],
      verification_questions: ['Câu hỏi D'],
      translated_at: 1789700100,
    });

    expect(success).toBe(true);
    expect(executedSql).toContain('INSERT INTO card_translations');
    expect(executedSql).toContain('ON CONFLICT(card_id, lang) DO UPDATE');
    expect(boundParams[0]).toBe('cluster_test_save');
    expect(boundParams[1]).toBe('vi');
    expect(boundParams[2]).toBe('Tóm tắt lưu thành công.');
  });

  it('handles "no such table" gracefully in getCardTranslation and auto-creates table', async () => {
    let createdTable = false;
    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('CREATE TABLE IF NOT EXISTS card_translations')) {
          createdTable = true;
          return { run: vi.fn().mockResolvedValue({ success: true }) };
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockRejectedValue(new Error('no such table: card_translations')),
          }),
        };
      }),
    } as unknown as D1Database;

    const result = await getCardTranslation(mockDb, makeClusterId('cluster_missing_table'), 'vi');
    expect(result).toBeNull();
    expect(createdTable).toBe(true);
  });

  it('handles "no such table" in saveCardTranslation by auto-creating table and retrying', async () => {
    let attempts = 0;
    let createdTable = false;

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('CREATE TABLE IF NOT EXISTS card_translations')) {
          createdTable = true;
          return { run: vi.fn().mockResolvedValue({ success: true }) };
        }
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockImplementation(async () => {
              attempts++;
              if (attempts === 1) {
                throw new Error('D1_ERROR: no such table: card_translations: SQLITE_ERROR');
              }
              return { success: true };
            }),
          }),
        };
      }),
    } as unknown as D1Database;

    const success = await saveCardTranslation(mockDb, {
      card_id: makeClusterId('cluster_retry_test'),
      lang: 'vi',
      summary: 'Thử lại sau khi tạo bảng',
      evidence: [],
      counter: [],
      context: [],
      verification_questions: [],
      translated_at: 1789700200,
    });

    expect(success).toBe(true);
    expect(createdTable).toBe(true);
    expect(attempts).toBe(2);
  });
});
