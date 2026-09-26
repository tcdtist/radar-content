import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getUnprocessedArticles } from '../lib/db/article-queries';
import { getDashboardStats } from '../lib/db/cluster-queries';
import { CrawlerRegistry } from '../lib/sources/crawler-registry';
import { getActiveSlotsForFrequency, getLocalHour, shouldExecuteCrawl } from '../lib/sources/schedule-manager';
import { executeScheduledCrawl, processArticlePipeline, QueueMessageBody, WorkerEnv } from './pipeline';
import { handleCheckExistingUrls, handleIngestPosts, IngestRequestPayload } from './ingest-handler';
import { requireIngestAuth } from './ingest-auth';
import { authApp, requireAdmin } from './auth-routes';
import { adminApp } from './admin-routes';
import { cardsApp } from './cards-routes';
import { triggerCreatorRadarScan } from './creator-radar-trigger';

const app = new Hono<{ Bindings: WorkerEnv }>();

// Enable CORS for frontend Vite development
app.use('*', cors());

// Modular sub-routers
app.route('/api/auth', authApp);
app.route('/api/admin', adminApp);
app.route('/api/cards', cardsApp);

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

// Manual trigger for crawl ingestion - Requires Admin
app.post('/api/crawl/trigger', requireAdmin, async (c) => {
  const registry = new CrawlerRegistry();
  const summary = await registry.runAll(c.env.DB, 10);
  return c.json({ success: true, summary });
});

// External / local crawler ingestion endpoint - Requires Ingest API Key or Admin
app.post('/api/ingest', requireIngestAuth, async (c) => {
  try {
    const payload = await c.req.json<IngestRequestPayload>();
    const res = await handleIngestPosts(c.env, payload);
    return c.json(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 400);
  }
});

// Check if URLs already exist in D1 (read-only deduplication check) - Requires Ingest API Key or Admin
app.post('/api/ingest/check', requireIngestAuth, async (c) => {
  try {
    const { urls } = await c.req.json<{ urls: string[] }>();
    const existingUrls = await handleCheckExistingUrls(c.env, urls || []);
    return c.json({ success: true, existingUrls });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 400);
  }
});

// Manual trigger for processing batch of articles - Requires Admin
// Uses async Queue to avoid HTTP timeout — Gemini LLM calls take 10-15s per article.
app.post('/api/process/trigger', requireAdmin, async (c) => {
  const pending = await getUnprocessedArticles(c.env.DB, 10);

  if (pending.length === 0) {
    return c.json({ success: true, totalPending: 0, queued: 0, message: 'No unprocessed articles found.' });
  }

  // Preferred path: enqueue to ARTICLE_QUEUE in batch → Queue consumer handles Gemini async
  if (c.env.ARTICLE_QUEUE) {
    const messages = pending.map((art) => ({
      body: { articleId: art.id, title: art.title, body: art.body, source: art.source },
    }));
    try {
      await c.env.ARTICLE_QUEUE.sendBatch(messages);
      return c.json({
        success: true,
        totalPending: pending.length,
        queued: pending.length,
        message: `Enqueued ${pending.length} articles in batch for async Gemini processing.`,
      });
    } catch (err) {
      console.error('[Process Trigger] Failed to sendBatch articles to queue:', err);
      return c.json({ success: false, error: 'Failed to enqueue articles' }, 500);
    }
  }

  // Fallback: process 1 article synchronously (no queue available)
  const art = pending[0];
  const ok = await processArticlePipeline(c.env, art.id, art.title, art.body, art.source);
  return c.json({ success: ok, totalPending: pending.length, processedCount: ok ? 1 : 0, message: 'Queue unavailable — processed 1 article synchronously.' });
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

// Manual / external trigger for Creator Radar scan via GitHub Actions - Requires Admin
app.post('/api/creator-radar/trigger', requireAdmin, async (c) => {
  const result = await triggerCreatorRadarScan(c.env);
  return c.json(result, result.success ? 200 : (result.status as any));
});

export default {
  fetch: app.fetch,

  // Cron trigger handler with configurable frequency gating
  async scheduled(controller: ScheduledController, env: WorkerEnv, _ctx: ExecutionContext): Promise<void> {
    const tz = env.TIMEZONE || 'Asia/Ho_Chi_Minh';
    const localHour = getLocalHour(controller.scheduledTime, tz);

    // 1. Trigger Creator Radar scan on GitHub Actions only at scheduled slots (00:01, 06:01, 12:01, 18:01 UTC+7)
    if ([0, 6, 12, 18].includes(localHour)) {
      await triggerCreatorRadarScan(env);
    }

    // 2. Frequency-gated crawl for radar-content articles
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
