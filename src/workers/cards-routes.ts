import { Hono } from 'hono';
import { MOCK_INTELLIGENCE_CARDS } from '../lib/data/mock-cards';
import { queryCards, updateCardStatus } from '../lib/db/cluster-queries';
import { queryCardById } from '../lib/db/card-detail-queries';
import { getLatestMockSnapshot } from '../lib/db/mock-snapshot-queries';
import { getCardTranslation, saveCardTranslation } from '../lib/db/translation-queries';
import { CardStatus, CardTranslation, makeClusterId } from '../lib/db/types';
import { CardToTranslate } from '../lib/llm/translation-prompt';
import { executeCardTranslation } from './translation-executor';
import { runDailyAdminSyncIfNeeded } from './admin-routes';
import { isRequestAuthorized, requireAdmin } from './auth-routes';
import { WorkerEnv } from './pipeline';

export const cardsApp = new Hono<{ Bindings: WorkerEnv }>();

/**
 * Get scored intelligence cards (Guest preview: top 12 snapshot; Admin: live D1 cards)
 */
cardsApp.get('/', async (c) => {
  const topic = c.req.query('topic') || 'all';
  const status = c.req.query('status') || 'READY,LEAD';
  const sort = (c.req.query('sort') as 'score' | 'newest' | 'evidence') || 'score';
  const page = c.req.query('page') ? parseInt(c.req.query('page')!, 10) : undefined;
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined;

  const isAuth = await isRequestAuthorized(c);
  if (!isAuth) {
    const snapshot = await getLatestMockSnapshot(c.env.DB);
    let mockList =
      snapshot?.cards && snapshot.cards.length > 0
        ? [...snapshot.cards]
        : [...MOCK_INTELLIGENCE_CARDS];

    if (topic && topic !== 'all') {
      mockList = mockList.filter((cd) =>
        cd.topic_tags.some((t) => t.toLowerCase() === topic.toLowerCase())
      );
    }
    if (status) {
      const allowed = status.split(',').map((s) => s.trim().toUpperCase());
      mockList = mockList.filter((cd) => allowed.includes(cd.status));
    }
    if (sort === 'newest') mockList.sort((a, b) => b.updated_at - a.updated_at);
    else if (sort === 'evidence')
      mockList.sort((a, b) => (b.evidence?.length || 0) - (a.evidence?.length || 0));
    else mockList.sort((a, b) => b.score - a.score);

    return c.json({
      success: true,
      cards: mockList.slice(0, 12),
      isMock: true,
      snapshotDate: snapshot?.syncDate || null,
      page: 1,
      limit: 12,
      filters: { topic, status, sort },
    });
  }

  // Admin visit: trigger daily snapshot & maintenance in background if first visit today
  if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
    c.executionCtx.waitUntil(runDailyAdminSyncIfNeeded(c.env));
  } else {
    runDailyAdminSyncIfNeeded(c.env).catch(() => {});
  }

  try {
    const cards = await queryCards(c.env.DB, { topic, status, sort, page, limit });
    return c.json({
      success: true,
      cards,
      isMock: false,
      page: page || 1,
      limit: limit || 50,
      filters: { topic, status, sort },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, cards: [], error: message }, 500);
  }
});

/**
 * Get a single card by ID (for deep linking and direct page reloads)
 */
cardsApp.get('/:id', async (c) => {
  const { id } = c.req.param();
  try {
    const card = await queryCardById(c.env.DB, makeClusterId(id));
    if (card) {
      return c.json({ success: true, card });
    }
    const mock = MOCK_INTELLIGENCE_CARDS.find((m) => m.id === id);
    if (mock) {
      return c.json({ success: true, card: mock });
    }
    return c.json({ success: false, error: 'Card not found' }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

/**
 * Update card status (Save, Dismiss, Written) - Requires Admin
 */
cardsApp.post('/:id/action', requireAdmin, async (c) => {
  const { id } = c.req.param();
  const { action } = await c.req.json<{ action: CardStatus }>();

  if (!['READY', 'LEAD', 'SAVED', 'WRITTEN', 'DISMISSED'].includes(action)) {
    return c.json({ success: false, error: 'Invalid card action status' }, 400);
  }

  try {
    const success = await updateCardStatus(c.env.DB, makeClusterId(id), action);
    return c.json({ id, action, success });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

/**
 * Translate card into Vietnamese on-demand - Requires Admin
 */
cardsApp.post('/:id/translate', requireAdmin, async (c) => {
  const { id } = c.req.param();
  const clusterId = makeClusterId(id);

  try {
    // 1. Check D1 cache first (bypass if force=true or if cached data is hollow/dummy)
    const force = c.req.query('force') === 'true';
    if (!force) {
      const cached = await getCardTranslation(c.env.DB, clusterId, 'vi');
      const isCorrupt = cached && (!cached.summary || cached.summary === 'Bản tóm tắt thử nghiệm' || (!cached.evidence?.length && !cached.counter?.length));
      if (cached && !isCorrupt) {
        return c.json({ success: true, translation: cached, isCached: true });
      }
    }

    // 2. Extract card data (from request body if provided, otherwise query D1 / mock)
    const body = await c.req.json<{ card?: CardToTranslate }>().catch(() => ({ card: undefined }));
    let cardToTranslate: CardToTranslate | undefined = body?.card;

    if (!cardToTranslate || !cardToTranslate.summary) {
      const dbCard = await queryCardById(c.env.DB, clusterId);
      if (!dbCard) {
        return c.json({ success: false, error: 'Card not found for translation' }, 404);
      }
      cardToTranslate = {
        label: dbCard.label,
        summary: dbCard.summary,
        evidence: dbCard.evidence,
        counter: dbCard.counter,
        context: dbCard.context,
        verification_questions: dbCard.verification_questions,
      };
    }

    // 3. Translate via Gemini with resilient Workers AI fallback
    const translated = await executeCardTranslation(c.env, cardToTranslate);

    // 4. Save to D1 cache
    const translationRecord: CardTranslation = {
      card_id: clusterId,
      lang: 'vi',
      summary: translated.summary,
      evidence: translated.evidence,
      counter: translated.counter,
      context: translated.context,
      verification_questions: translated.verification_questions,
      translated_at: Math.floor(Date.now() / 1000),
    };

    await saveCardTranslation(c.env.DB, translationRecord);

    return c.json({
      success: true,
      translation: translationRecord,
      isCached: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

