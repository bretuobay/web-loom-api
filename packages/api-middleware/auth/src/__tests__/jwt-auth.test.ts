import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { jwtAuth } from '../jwt-auth';

const SECRET = 'test-secret';

async function makeToken(payload: Record<string, unknown>, secret = SECRET) {
  return sign(payload, secret);
}

function buildApp(options: Parameters<typeof jwtAuth>[0]) {
  const app = new Hono();
  app.use('/test', jwtAuth(options));
  app.get('/test', (c) => c.json({ userId: c.var.user?.id, role: c.var.user?.role }));
  return app;
}

describe('jwtAuth', () => {
  it('returns 401 when no Authorization header is present', async () => {
    const app = buildApp({ secret: SECRET });
    const res = await app.request('/test');
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for an invalid token', async () => {
    const app = buildApp({ secret: SECRET });
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer not.a.valid.token' },
    });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for a token signed with the wrong secret', async () => {
    const token = await makeToken({ sub: 'u1' }, 'wrong-secret');
    const app = buildApp({ secret: SECRET });
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it('sets c.var.user and calls next for a valid token', async () => {
    const token = await makeToken({ sub: 'u1', email: 'u@example.com', role: 'admin' });
    const app = buildApp({ secret: SECRET });
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('u1');
    expect(body.role).toBe('admin');
  });

  it('returns 401 when issuer does not match', async () => {
    const token = await makeToken({ sub: 'u1', iss: 'other-issuer' });
    const app = buildApp({ secret: SECRET, issuer: 'expected-issuer' });
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it('passes when issuer matches', async () => {
    const token = await makeToken({ sub: 'u1', iss: 'my-app' });
    const app = buildApp({ secret: SECRET, issuer: 'my-app' });
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it('returns 401 when audience does not match', async () => {
    const token = await makeToken({ sub: 'u1', aud: 'other-audience' });
    const app = buildApp({ secret: SECRET, audience: 'expected-audience' });
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it('passes when audience matches (string)', async () => {
    const token = await makeToken({ sub: 'u1', aud: 'api' });
    const app = buildApp({ secret: SECRET, audience: 'api' });
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it('passes when audience matches one of the expected values (array)', async () => {
    const token = await makeToken({ sub: 'u1', aud: 'api' });
    const app = buildApp({ secret: SECRET, audience: ['api', 'admin'] });
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  describe('optional mode', () => {
    it('calls next without setting user when no token is present', async () => {
      const app = buildApp({ secret: SECRET, optional: true });
      const res = await app.request('/test');
      expect(res.status).toBe(200);
      expect((await res.json()).userId).toBeUndefined();
    });

    it('calls next without setting user when token is invalid', async () => {
      const app = buildApp({ secret: SECRET, optional: true });
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer bad.token.here' },
      });
      expect(res.status).toBe(200);
      expect((await res.json()).userId).toBeUndefined();
    });
  });

  it('uses a custom getUser mapping when provided', async () => {
    const token = await makeToken({ userId: 'custom-1', userRole: 'superadmin' });
    const app = buildApp({
      secret: SECRET,
      getUser: (p) => ({ id: String(p.userId), role: p.userRole as string }),
    });
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('custom-1');
    expect(body.role).toBe('superadmin');
  });
});
