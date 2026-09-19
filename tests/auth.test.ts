import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ALLOWED_EMAILS,
  getAdminEmail,
  getAllowedEmails,
  getJwtSecret,
  isEmailAllowed,
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

  describe('Whitelist Normalization & Access Control', () => {
    it('defaults to admin@example.com when neither ALLOWED_EMAILS nor ADMIN_EMAIL is set', () => {
      const env: WorkerEnv = { DB: {} as D1Database };
      expect(getAllowedEmails(env)).toEqual(DEFAULT_ALLOWED_EMAILS);
      expect(isEmailAllowed('admin@example.com', env)).toBe(true);
      expect(isEmailAllowed('stranger@gmail.com', env)).toBe(false);
    });

    it('parses comma-separated ALLOWED_EMAILS with trimming and lowercase conversion', () => {
      const env: WorkerEnv = {
        DB: {} as D1Database,
        ALLOWED_EMAILS: ' lead_dev@domain.com ,  admin@domain.com, CO-WORKER@example.COM  ',
      };
      const list = getAllowedEmails(env);
      expect(list).toEqual(['lead_dev@domain.com', 'admin@domain.com', 'co-worker@example.com']);
      expect(isEmailAllowed('LEAD_DEV@DOMAIN.COM', env)).toBe(true);
      expect(isEmailAllowed('admin@domain.com', env)).toBe(true);
      expect(isEmailAllowed('co-worker@example.com', env)).toBe(true);
      expect(isEmailAllowed('unauthorized@gmail.com', env)).toBe(false);
      expect(isEmailAllowed('', env)).toBe(false);
      expect(isEmailAllowed(null, env)).toBe(false);
      expect(isEmailAllowed(undefined, env)).toBe(false);
    });

    it('falls back to ADMIN_EMAIL when ALLOWED_EMAILS is missing', () => {
      const env: WorkerEnv = {
        DB: {} as D1Database,
        ADMIN_EMAIL: 'team_admin@startup.io',
      };
      expect(getAllowedEmails(env)).toEqual(['team_admin@startup.io']);
      expect(isEmailAllowed('team_admin@startup.io', env)).toBe(true);
      expect(isEmailAllowed('admin@example.com', env)).toBe(false);
    });
  });
});
