import { WorkerEnv } from './pipeline';

/**
 * Triggers automated X/Twitter Harvester on GitHub Actions via workflow_dispatch.
 * This runs the harvester with configured X cookies in a headless Node environment
 * and ingests parsed discussion threads back to the Worker via /api/ingest.
 */
export async function triggerXCrawlerDispatch(env: WorkerEnv): Promise<boolean> {
  const token = env.RADAR_GITHUB_TOKEN;
  if (!token) {
    return false;
  }

  const repo = env.GITHUB_REPOSITORY || 'tcdtist/radar-content';
  const url = `https://api.github.com/repos/${repo}/actions/workflows/x-crawler-cron.yml/dispatches`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'radar-content-worker',
      },
      body: JSON.stringify({ ref: 'main' }),
    });
    return res.status === 204;
  } catch (err) {
    console.error('[Scheduler] Automated X Harvester dispatch error:', err);
    return false;
  }
}
