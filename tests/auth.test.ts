import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADMIN_EMAIL,
  getAdminEmail,
  getJwtSecret,
  SessionPayload,
  signSessionToken,
  verifySessionToken,
} from '../src/workers/auth';
import { WorkerEnv } from '../src/workers/pipeline';

describe('Auth & Session Tokens (WebCrypto HMAC-SHA256)', () => {
  const secret = 'super-secret-test-key-for-radar-content-auth';

  it('signs and verifies valid session token for admin', async () => {
    const payload: SessionPayload = {
      email: 'admin@example.com',

      name: 'Admin User',
      role: 'admin',
      exp: Date.now() + 3600 * 1000,
    };

    const token = await signSessionToken(payload, secret);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const verified = await verifySessionToken(token, secret);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe('admin@example.com');

    expect(verified?.role).toBe('admin');
  });

  it('rejects expired session token', async () => {
    const payload: SessionPayload = {
      email: 'admin@example.com',

      role: 'admin',
      exp: Date.now() - 1000, // expired 1s ago
    };

    const token = await signSessionToken(payload, secret);
    const verified = await verifySessionToken(token, secret);
    expect(verified).toBeNull();
  });

  it('rejects token signed with a different secret', async () => {
    const payload: SessionPayload = {
      email: 'admin@example.com',

      role: 'admin',
      exp: Date.now() + 3600 * 1000,
    };

    const token = await signSessionToken(payload, 'wrong-secret');
    const verified = await verifySessionToken(token, secret);
    expect(verified).toBeNull();
  });

  it('rejects tampered token payload', async () => {
    const payload: SessionPayload = {
      email: 'admin@example.com',

      role: 'admin',
      exp: Date.now() + 3600 * 1000,
    };

    const token = await signSessionToken(payload, secret);
    const parts = token.split('.');
    // Tamper with payload part
    const tampered = `${parts[0]}.eyJlbWFpbCI6ImhhY2tlckBnbWFpbC5jb20ifQ.${parts[2]}`;
    const verified = await verifySessionToken(tampered, secret);
    expect(verified).toBeNull();
  });

  it('resolves admin email from env or default', () => {
    const envWithAdmin: WorkerEnv = {
      DB: {} as D1Database,
      ADMIN_EMAIL: 'CUSTOM_ADMIN@gmail.com',
    };
    expect(getAdminEmail(envWithAdmin)).toBe('custom_admin@gmail.com');

    const envDefault: WorkerEnv = {
      DB: {} as D1Database,
    };
    expect(getAdminEmail(envDefault)).toBe(DEFAULT_ADMIN_EMAIL.toLowerCase());
  });

  it('resolves jwt secret from env with fallback', () => {
    const env: WorkerEnv = {
      DB: {} as D1Database,
      JWT_SECRET: 'my-custom-jwt-secret',
    };
    expect(getJwtSecret(env)).toBe('my-custom-jwt-secret');
  });
});
