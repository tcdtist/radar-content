import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getUnprocessedArticles } from '../lib/db/article-queries';
import { getDashboardStats, queryCards, updateCardStatus } from '../lib/db/cluster-queries';
import { CardStatus, makeClusterId } from '../lib/db/types';
import { CrawlerRegistry } from '../lib/sources/crawler-registry';
import { getActiveSlotsForFrequency, getLocalHour, shouldExecuteCrawl } from '../lib/sources/schedule-manager';
import { executeScheduledCrawl, processArticlePipeline, QueueMessageBody, WorkerEnv } from './pipeline';
import { handleIngestPosts, IngestRequestPayload } from './ingest-handler';
import { authApp, requireAdmin } from './auth-routes';

const app = new Hono<{ Bindings: WorkerEnv }>();

// Enable CORS for frontend Vite development
app.use('*', cors());

// Auth routes (Google OAuth, passkey login, session check)
app.route('/api/auth', authApp);

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'radar-content',
    status: 'ok',
    version: '0.1.0',
    timestamp: Math.floor(Date.now() / 1000),
  });
});

// Dashboard stats summary (Restricted to authenticated admin)
app.get('/api/stats', requireAdmin, async (c) => {
  try {
    const stats = await getDashboardStats(c.env.DB);
    return c.json({ success: true, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

// Get scored intelligence cards with filters
app.get('/api/cards', async (c) => {
  const topic = c.req.query('topic') || 'all';
  const status = c.req.query('status') || 'READY,LEAD';
  const sort = (c.req.query('sort') as 'score' | 'newest' | 'evidence') || 'score';
  const page = c.req.query('page') ? parseInt(c.req.query('page')!, 10) : undefined;
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined;

  try {
    const cards = await queryCards(c.env.DB, { topic, status, sort, page, limit });
    return c.json({ success: true, cards, page: page || 1, limit: limit || 50, filters: { topic, status, sort } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, cards: [], error: message }, 500);
  }
});

// Update card status (Save, Dismiss, Written) - Requires Admin
app.post('/api/cards/:id/action', requireAdmin, async (c) => {
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

// Manual trigger for crawl ingestion - Requires Admin
app.post('/api/crawl/trigger', requireAdmin, async (c) => {
  const registry = new CrawlerRegistry();
  const summary = await registry.runAll(c.env.DB, 10);
  return c.json({ success: true, summary });
});

// External / local crawler ingestion endpoint
app.post('/api/ingest', async (c) => {
  try {
    const payload = await c.req.json<IngestRequestPayload>();
    const res = await handleIngestPosts(c.env, payload);
    return c.json(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 400);
  }
});

// Manual trigger for processing batch of articles - Requires Admin
app.post('/api/process/trigger', requireAdmin, async (c) => {
  const pending = await getUnprocessedArticles(c.env.DB, 5);
  let processedCount = 0;

  for (const art of pending) {
    const ok = await processArticlePipeline(c.env, art.id, art.title, art.body, art.source);
    if (ok) processedCount++;
  }

  return c.json({ success: true, totalPending: pending.length, processedCount });
});

// Crawl schedule status endpoint
app.get('/api/schedule', (c) => {
  const freq = Math.max(1, Math.min(4, parseInt(c.env.CRAWL_FREQUENCY || '1', 10) || 1));
  const tz = c.env.TIMEZONE || 'Asia/Ho_Chi_Minh';
  const localHour = getLocalHour(Date.now(), tz);
  const activeSlots = getActiveSlotsForFrequency(freq);

  return c.json({
    success: true,
    frequency: freq,
    timezone: tz,
    currentLocalHour: localHour,
    activeSlots: activeSlots.map((h) => `${String(h).padStart(2, '0')}:01`),
    allPossibleSlots: {
      '1x': ['00:01 (Midnight)'],
      '2x': ['00:01 (Midnight)', '12:01 (Noon)'],
      '3x': ['00:01 (Midnight)', '12:01 (Noon)', '18:01 (Evening)'],
      '4x': ['00:01 (Midnight)', '06:01 (Morning)', '12:01 (Noon)', '18:01 (Evening)'],
    },
    description: `Automated crawler is set to run ${freq} time(s) per day in ${tz}.`,
  });
});

export default {
  fetch: app.fetch,

  // Cron trigger handler with configurable frequency gating
  async scheduled(controller: ScheduledController, env: WorkerEnv, _ctx: ExecutionContext): Promise<void> {
    const decision = shouldExecuteCrawl(env.CRAWL_FREQUENCY, controller.scheduledTime, env.TIMEZONE);
    console.log(`[Worker Scheduler] ${decision.reason}`);

    if (!decision.shouldRun) {
      return;
    }

    console.log('[Worker] Cron triggered: starting automated content crawl...');
    await executeScheduledCrawl(env);
  },

  // Queue consumer — processes articles through Gemini
  async queue(batch: MessageBatch<QueueMessageBody>, env: WorkerEnv, _ctx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      let { articleId, title, body, source } = message.body;
      if (!title || !source) {
        const row = await env.DB.prepare(
          'SELECT title, body, source FROM articles WHERE id = ?'
        ).bind(articleId).first<{ title: string; body: string | null; source: string }>();
        if (row) {
          title = row.title;
          body = row.body;
          source = row.source;
        }
      }
      if (title && source) {
        console.log('[Queue] Processing article:', articleId);
        await processArticlePipeline(env, articleId, title, body, source);
      }
      message.ack();
    }
  },
};
