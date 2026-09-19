import { Hono } from 'hono';
import { getLatestMockSnapshot, syncTop12MockCards } from '../lib/db/mock-snapshot-queries';
import { pruneStaleData } from '../lib/db/prune-queries';
import { requireAdmin } from './auth-routes';
import { WorkerEnv } from './pipeline';

export const adminApp = new Hono<{ Bindings: WorkerEnv }>();

// All admin routes require admin authentication
adminApp.use('*', requireAdmin);

/**
 * Trigger mock cards snapshot sync manually
 */
adminApp.post('/sync-mock', async (c) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await syncTop12MockCards(c.env.DB, today);
    return c.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

/**
 * Trigger data retention pruning manually
 */
adminApp.post('/prune', async (c) => {
  try {
    const stats = await pruneStaleData(c.env.DB);
    return c.json({ success: true, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

/**
 * Dispatches GitHub Action workflow if RADAR_GITHUB_TOKEN is configured
 */
export async function triggerGitHubMockSync(env: WorkerEnv): Promise<boolean> {
  const token = env.RADAR_GITHUB_TOKEN;
  if (!token) return false;

  const repo = env.GITHUB_REPOSITORY || 'tcdtist/radar-content';

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/sync-mock-cards.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'radar-content-worker',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    );
    return res.status === 204;
  } catch (err) {
    console.error('[Admin] GitHub workflow dispatch error:', err);
    return false;
  }
}

/**
 * Performs daily sync on first admin visit of each day:
 * 1. Takes top-12 highest-scoring cards from D1 into mock_snapshot
 * 2. Prunes obsolete articles and clusters (immunizing SAVED & WRITTEN)
 * 3. Triggers GitHub Action if token is available
 */
export async function runDailyAdminSyncIfNeeded(env: WorkerEnv): Promise<{ synced: boolean; syncDate: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await getLatestMockSnapshot(env.DB);

  if (existing && existing.syncDate === today) {
    return { synced: false, syncDate: today };
  }

  console.log(`[AdminSync] First admin visit of the day (${today}). Running top-12 snapshot and auto-prune...`);
  const snapshotResult = await syncTop12MockCards(env.DB, today);
  await pruneStaleData(env.DB);
  await triggerGitHubMockSync(env);

  return { synced: snapshotResult.synced, syncDate: today };
}
