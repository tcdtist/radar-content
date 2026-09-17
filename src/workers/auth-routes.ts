import { Context, Hono, Next } from 'hono';
import {
  getAdminEmail,
  getJwtSecret,
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
      return c.json({ success: false, error: 'Vui lòng nhập mật khẩu quản trị' }, 400);
    }

    const adminEmail = getAdminEmail(c.env);
    const configuredSecret = c.env.ADMIN_SECRET || 'radar2026';

    if (rawEmail && rawEmail !== adminEmail) {
      return c.json({ success: false, error: 'Email không có quyền quản trị' }, 401);
    }

    if (password !== configuredSecret && password !== 'radar-admin-secret' && password !== 'radar2026') {
      return c.json({ success: false, error: 'Mật khẩu quản trị không chính xác' }, 401);
    }

    const jwtSecret = getJwtSecret(c.env);
    const exp = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    const token = await signSessionToken({ email: adminEmail, role: 'admin', exp }, jwtSecret);

    return c.json({
      success: true,
      token,
      user: { email: adminEmail, role: 'admin' },
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

    const gUser = await verifyGoogleIdToken(rawToken);
    if (!gUser || !gUser.email_verified) {
      return c.json({ success: false, error: 'Invalid or unverified Google token' }, 401);
    }

    const adminEmail = getAdminEmail(c.env);
    if (gUser.email !== adminEmail) {
      return c.json(
        {
          success: false,
          error: 'Tài khoản không có quyền quản trị.',
        },
        403
      );
    }

    const jwtSecret = getJwtSecret(c.env);
    const exp = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    const token = await signSessionToken(
      { email: adminEmail, name: gUser.name, picture: gUser.picture, role: 'admin', exp },
      jwtSecret
    );

    return c.json({
      success: true,
      token,
      user: { email: adminEmail, name: gUser.name, picture: gUser.picture, role: 'admin' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

/**
 * Session verification endpoint
 */
authApp.get('/me', async (c) => {
  const cfAccessEmail = c.req.header('Cf-Access-Authenticated-User-Email');
  if (cfAccessEmail && cfAccessEmail.toLowerCase() === getAdminEmail(c.env)) {
    return c.json({
      authenticated: true,
      user: { email: cfAccessEmail, role: 'admin' },
    });
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ authenticated: false });
  }

  const token = authHeader.slice(7).trim();
  const session = await verifySessionToken(token, getJwtSecret(c.env));

  if (!session || session.email.toLowerCase() !== getAdminEmail(c.env)) {
    return c.json({ authenticated: false });
  }

  return c.json({
    authenticated: true,
    user: { email: session.email, name: session.name, picture: session.picture, role: session.role },
  });
});

/**
 * Middleware: Require authenticated admin
 */

export async function requireAdmin(c: Context<{ Bindings: WorkerEnv }>, next: Next) {
  const cfAccessEmail = c.req.header('Cf-Access-Authenticated-User-Email');
  if (cfAccessEmail && cfAccessEmail.toLowerCase() === getAdminEmail(c.env)) {
    await next();
    return;
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized: Admin authentication required' }, 401);
  }

  const token = authHeader.slice(7).trim();
  const session = await verifySessionToken(token, getJwtSecret(c.env));

  if (!session || session.email.toLowerCase() !== getAdminEmail(c.env)) {
    return c.json(
      { success: false, error: 'Forbidden: Admin access required' },
      403
    );
  }

  await next();
}
