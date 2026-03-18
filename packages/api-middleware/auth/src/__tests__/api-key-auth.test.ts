import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { apiKeyAuth } from '../api-key-auth';
import type { AuthUser } from '../types';

const VALID_USER: AuthUser = { id: 'u1', email: 'test@example.com', role: 'user' };

function buildApp(validate: (key: string) => AuthUser | null | Promise<AuthUser | null>) {
  const app = new Hono();
  app.use('/test', apiKeyAuth({ validate }));
  app.get('/test', (c) => c.json({ userId: c.var.user?.id }));
  return app;
}

describe('apiKeyAuth', () => {
  it('returns 401 when no key header is present', async () => {
    const app = buildApp(() => null);
    const res = await app.request('/test');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when validate() returns null', async () => {
    const app = buildApp(() => null);
    const res = await app.request('/test', {
      headers: { 'X-API-Key': 'bad-key' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('sets c.var.user and calls next on valid key via X-API-Key header', async () => {
    const app = buildApp(() => VALID_USER);
    const res = await app.request('/test', {
      headers: { 'X-API-Key': 'valid-key' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('u1');
  });

  it('accepts Authorization: Bearer <key> as fallback for X-API-Key default', async () => {
    const app = buildApp(() => VALID_USER);
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-key' },
    });
    expect(res.status).toBe(200);
  });

  it('does not accept Authorization: Bearer when a custom header is configured', async () => {
    const app = new Hono();
    app.use('/test', apiKeyAuth({ validate: () => VALID_USER, header: 'X-Custom-Key' }));
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-key' },
    });
    expect(res.status).toBe(401);
  });

  it('reads the key from a custom header when configured', async () => {
    const app = new Hono();
    app.use('/test', apiKeyAuth({ validate: () => VALID_USER, header: 'X-Custom-Key' }));
    app.get('/test', (c) => c.json({ userId: c.var.user?.id }));

    const res = await app.request('/test', {
      headers: { 'X-Custom-Key': 'valid-key' },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).userId).toBe('u1');
  });

  it('passes the raw key string to validate()', async () => {
    let receivedKey = '';
    const app = buildApp((key) => {
      receivedKey = key;
      return VALID_USER;
    });

    await app.request('/test', { headers: { 'X-API-Key': 'my-secret-key' } });
    expect(receivedKey).toBe('my-secret-key');
  });

  it('supports async validate()', async () => {
    const app = buildApp(async () => {
      await Promise.resolve();
      return VALID_USER;
    });
    const res = await app.request('/test', { headers: { 'X-API-Key': 'k' } });
    expect(res.status).toBe(200);
  });
});
