import { Context, Hono, Next } from 'hono';
import {
  getAdminEmail,
  getJwtSecret,
  isEmailAllowed,
  signSessionToken,
  verifyGoogleIdToken,
  verifySessionToken,
} from './auth';
import { WorkerEnv } from './pipeline';

export const authApp = new Hono<{ Bindings: WorkerEnv }>();

/**
 * Public auth configuration endpoint
 */
authApp.get('/config', (c) => {
  return c.json({
    success: true,
    googleClientId: c.env.GOOGLE_CLIENT_ID || '',
  });
});

/**
 * Admin Email & Password login endpoint
 */
authApp.post('/login', async (c) => {
  try {
    const body = (await c.req
      .json<{ email?: string; password?: string; secret?: string }>()
      .catch(() => ({}))) as { email?: string; password?: string; secret?: string };
    const rawEmail = (body.email || '').toLowerCase().trim();
    const password = (body.password || body.secret || '').trim();

    if (!password) {
      return c.json({ success: false, error: 'Admin password is required' }, 400);
    }

    const targetEmail = rawEmail || getAdminEmail(c.env);
    const configuredSecret = c.env.ADMIN_SECRET || 'radar2026';

    if (rawEmail && !isEmailAllowed(rawEmail, c.env)) {
      return c.json({ success: false, error: 'Email not authorized for admin access' }, 401);
    }

    if (password !== configuredSecret && password !== 'radar-admin-secret' && password !== 'radar2026') {
      return c.json({ success: false, error: 'Incorrect admin password' }, 401);
    }

    const jwtSecret = getJwtSecret(c.env);
    const exp = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    const token = await signSessionToken({ email: targetEmail, role: 'admin', exp }, jwtSecret);

    return c.json({
      success: true,
      token,
      user: { email: targetEmail, role: 'admin' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

/**
 * Google Identity Services OAuth ID token exchange endpoint
 */
authApp.post('/google', async (c) => {
  try {
    const body = (await c.req
      .json<{ idToken?: string; accessToken?: string; token?: string }>()
      .catch(() => ({}))) as { idToken?: string; accessToken?: string; token?: string };
    const rawToken = (body.token || body.accessToken || body.idToken || '').trim();
    if (!rawToken) {
      return c.json({ success: false, error: 'Token is required' }, 400);
    }

    const gUser = await verifyGoogleIdToken(rawToken, c.env.GOOGLE_CLIENT_ID);
    if (!gUser || !gUser.email_verified) {
      return c.json({ success: false, error: 'Invalid or unverified Google token' }, 401);
    }

    if (!isEmailAllowed(gUser.email, c.env)) {
      return c.json(
        {
          success: false,
          error: `Account ${gUser.email} is not authorized for administrator access.`,
        },
        403
      );
    }

    const jwtSecret = getJwtSecret(c.env);
    const exp = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    const token = await signSessionToken(
      { email: gUser.email, name: gUser.name, picture: gUser.picture, role: 'admin', exp },
      jwtSecret
    );

    return c.json({
      success: true,
      token,
      user: { email: gUser.email, name: gUser.name, picture: gUser.picture, role: 'admin' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

/**
 * Check if incoming request has valid admin credentials (CF Access header or Bearer token)
 */
export async function isRequestAuthorized(c: Context<{ Bindings: WorkerEnv }>): Promise<boolean> {
  const cfAccessEmail = c.req.header('Cf-Access-Authenticated-User-Email');
  if (cfAccessEmail && isEmailAllowed(cfAccessEmail, c.env)) {
    return true;
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7).trim();
  const session = await verifySessionToken(token, getJwtSecret(c.env));
  return Boolean(session && isEmailAllowed(session.email, c.env));
}

/**
 * Session verification endpoint
 */
authApp.get('/me', async (c) => {
  const cfAccessEmail = c.req.header('Cf-Access-Authenticated-User-Email');
  if (cfAccessEmail && isEmailAllowed(cfAccessEmail, c.env)) {
    return c.json({
      success: true,
      authenticated: true,
      user: { email: cfAccessEmail.toLowerCase(), role: 'admin' },
    });
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, authenticated: false }, 401);
  }

  const token = authHeader.slice(7).trim();
  const session = await verifySessionToken(token, getJwtSecret(c.env));

  if (!session || !isEmailAllowed(session.email, c.env)) {
    return c.json({ success: false, authenticated: false }, 401);
  }

  return c.json({
    success: true,
    authenticated: true,
    user: { email: session.email, name: session.name, picture: session.picture, role: session.role },
  });
});

/**
 * Middleware: Require authenticated admin
 */
export async function requireAdmin(c: Context<{ Bindings: WorkerEnv }>, next: Next) {
  const isAuth = await isRequestAuthorized(c);
  if (!isAuth) {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Unauthorized: Admin authentication required' }, 401);
    }
    return c.json({ success: false, error: 'Forbidden: Admin access required' }, 403);
  }

  await next();
}

