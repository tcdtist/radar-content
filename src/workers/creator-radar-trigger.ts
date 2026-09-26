import { WorkerEnv } from './pipeline';

/**
 * Triggers Creator Radar scan on GitHub Actions via workflow_dispatch.
 * This ensures execution starts within seconds at the exact scheduled slots
 * (00:01, 06:01, 12:01, 18:01 UTC+7), bypassing GitHub Actions cron queue delays.
 */
export async function triggerCreatorRadarScan(
  env: WorkerEnv,
  options?: { creator?: string; allTime?: boolean }
): Promise<{ success: boolean; status: number; message: string }> {
  const token = env.RADAR_GITHUB_TOKEN;
  if (!token) {
    console.warn('[Scheduler] RADAR_GITHUB_TOKEN not configured. Skipping Creator Radar dispatch.');
    return { success: false, status: 401, message: 'RADAR_GITHUB_TOKEN is not configured.' };
  }

  const repo = 'tcdtist/creator-radar';
  const workflow = 'cron-scan.yml';
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;

  const inputs: Record<string, string> = {};
  if (options?.creator) inputs.creator = options.creator;
  if (options?.allTime) inputs.all_time = 'true';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'radar-content-worker',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: Object.keys(inputs).length > 0 ? inputs : undefined,
      }),
    });

    if (res.status === 204) {
      console.log('🚀 [Scheduler] Successfully dispatched Creator Radar scan to GitHub Actions.');
      return { success: true, status: 204, message: 'Workflow dispatched successfully.' };
    }

    const errorText = await res.text().catch(() => '');
    console.error(`❌ [Scheduler] GitHub dispatch failed HTTP ${res.status}: ${errorText}`);
    return { success: false, status: res.status, message: errorText || `HTTP ${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌ [Scheduler] Failed to dispatch Creator Radar scan:', err);
    return { success: false, status: 500, message: msg };
  }
}
