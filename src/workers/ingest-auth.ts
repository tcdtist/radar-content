import { Context, Next } from 'hono';
import { isRequestAuthorized } from './auth-routes';
import { WorkerEnv } from './pipeline';

/**
 * Resolve the expected Ingest API key from Worker environment.
 * Falls back to ADMIN_SECRET if INGEST_API_KEY is not explicitly set.
 */
export function getIngestApiKey(env: WorkerEnv): string | undefined {
  return env.INGEST_API_KEY || env.ADMIN_SECRET;
}

/**
 * Check if the incoming request is authorized to perform ingestion or check URLs.
 * Authorized if:
 * 1. Bearer token matches INGEST_API_KEY or ADMIN_SECRET
 * 2. X-Ingest-Key header matches INGEST_API_KEY or ADMIN_SECRET
 * 3. Valid authenticated admin session (JWT or Cloudflare Access)
 */
export async function isIngestAuthorized(c: Context<{ Bindings: WorkerEnv }>): Promise<boolean> {
  const authHeader = c.req.header('Authorization');
  const customKeyHeader = c.req.header('X-Ingest-Key');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : customKeyHeader?.trim();

  const expectedKey = getIngestApiKey(c.env);
  if (token && expectedKey && token === expectedKey) {
    return true;
  }

  return await isRequestAuthorized(c);
}

/**
 * Middleware: Enforce API Key or Admin authentication on Ingestion endpoints.
 */
export async function requireIngestAuth(c: Context<{ Bindings: WorkerEnv }>, next: Next) {
  const authorized = await isIngestAuthorized(c);
  if (!authorized) {
    return c.json(
      {
        success: false,
        error: 'Unauthorized: Valid ingest API key or admin token required',
      },
      401
    );
  }

  await next();
}
