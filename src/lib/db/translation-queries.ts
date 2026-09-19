import { CardTranslation, ClusterId, makeClusterId } from './types';

interface RawCardTranslationRow {
  card_id: string;
  lang: string;
  summary: string;
  evidence: string;
  counter: string;
  context: string;
  verification_questions: string;
  translated_at: number;
}

function safeParseArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()) : [];
  } catch {
    return [];
  }
}

/**
 * Ensure card_translations table exists in D1 (defense-in-depth for unmigrated or fresh databases).
 */
export async function ensureTranslationsTable(db: D1Database): Promise<void> {
  const res = await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS card_translations (
         card_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
         lang TEXT NOT NULL DEFAULT 'vi',
         summary TEXT NOT NULL,
         evidence TEXT NOT NULL,
         counter TEXT NOT NULL,
         context TEXT NOT NULL,
         verification_questions TEXT NOT NULL,
         translated_at INTEGER NOT NULL DEFAULT (unixepoch()),
         PRIMARY KEY (card_id, lang)
       )`
    )
    .run();

  if (!res.success) {
    throw new Error('Failed to create card_translations table in D1 database');
  }
}

/**
 * Fetch cached card translation by card ID and language.
 */
export async function getCardTranslation(
  db: D1Database,
  cardId: ClusterId,
  lang: string = 'vi'
): Promise<CardTranslation | null> {
  try {
    const stmt = db.prepare(
      `SELECT card_id, lang, summary, evidence, counter, context, verification_questions, translated_at
       FROM card_translations
       WHERE card_id = ? AND lang = ?
       LIMIT 1`
    );

    const row = await stmt.bind(cardId, lang).first<RawCardTranslationRow>();
    if (!row) return null;

    return {
      card_id: makeClusterId(row.card_id),
      lang: row.lang,
      summary: row.summary,
      evidence: safeParseArray(row.evidence),
      counter: safeParseArray(row.counter),
      context: safeParseArray(row.context),
      verification_questions: safeParseArray(row.verification_questions),
      translated_at: row.translated_at,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('no such table')) {
      await ensureTranslationsTable(db);
    }
    return null;
  }
}

/**
 * Save or update card translation cache in D1.
 */
export async function saveCardTranslation(
  db: D1Database,
  translation: CardTranslation
): Promise<boolean> {
  const insertSql = `INSERT INTO card_translations (
       card_id, lang, summary, evidence, counter, context, verification_questions, translated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(card_id, lang) DO UPDATE SET
       summary = excluded.summary,
       evidence = excluded.evidence,
       counter = excluded.counter,
       context = excluded.context,
       verification_questions = excluded.verification_questions,
       translated_at = excluded.translated_at`;

  const bindParams: (string | number)[] = [
    translation.card_id,
    translation.lang,
    translation.summary,
    JSON.stringify(translation.evidence || []),
    JSON.stringify(translation.counter || []),
    JSON.stringify(translation.context || []),
    JSON.stringify(translation.verification_questions || []),
    translation.translated_at || Math.floor(Date.now() / 1000),
  ];

  try {
    const res = await db.prepare(insertSql).bind(...bindParams).run();
    return res.success;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('no such table')) {
      await ensureTranslationsTable(db);
      const retryRes = await db.prepare(insertSql).bind(...bindParams).run();
      return retryRes.success;
    }
    throw err;
  }
}
