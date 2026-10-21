import { getCardTranslation, saveCardTranslation } from '../db/translation-queries';
import { makeClusterId } from '../db/types';
import { CardToTranslate } from '../llm/translation-prompt';
import { TranslatedCardContent } from '../llm/translator';
import { ClusterCandidate, LinkedArticleExtraction } from './discord-formatter';

export function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()) : [];
  } catch {
    return [];
  }
}

/**
 * Resolves Vietnamese translation for a cluster alert.
 * 1. Checks cached translation in D1.
 * 2. If missing and translateFn is provided, translates and saves to D1 cache.
 */
export async function resolveClusterTranslation(
  db: D1Database,
  cluster: ClusterCandidate,
  articles: LinkedArticleExtraction[],
  translateFn?: (card: CardToTranslate) => Promise<TranslatedCardContent>
): Promise<{ summary?: string; evidence?: string[]; counter?: string[] } | undefined> {
  const clusterId = makeClusterId(cluster.id);
  const cached = await getCardTranslation(db, clusterId, 'vi');
  if (cached && cached.summary && cached.summary !== 'Bản tóm tắt thử nghiệm') {
    return {
      summary: cached.summary,
      evidence: cached.evidence,
      counter: cached.counter,
    };
  }

  if (!translateFn) return undefined;

  const rawSummary = articles.find((a) => a.summary)?.summary || cluster.label;
  const rawEvidence = articles.flatMap((a) => parseJsonArray(a.evidence));
  const rawCounters = articles.flatMap((a) => parseJsonArray(a.counter));

  const cardToTranslate: CardToTranslate = {
    label: cluster.label,
    summary: rawSummary,
    evidence: Array.from(new Set(rawEvidence)).slice(0, 3),
    counter: Array.from(new Set(rawCounters)).slice(0, 3),
    context: [],
    verification_questions: [],
  };

  try {
    const translated = await translateFn(cardToTranslate);
    await saveCardTranslation(db, {
      card_id: clusterId,
      lang: 'vi',
      summary: translated.summary,
      evidence: translated.evidence,
      counter: translated.counter,
      context: translated.context || [],
      verification_questions: translated.verification_questions || [],
      translated_at: Math.floor(Date.now() / 1000),
    });
    return translated;
  } catch (err) {
    console.warn(`[DiscordNotifier] Translation fallback for ${cluster.id}:`, err);
    return undefined;
  }
}
