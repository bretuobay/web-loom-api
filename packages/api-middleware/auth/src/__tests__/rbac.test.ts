import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requireRole, requirePermission } from '../require-role';
import { composeAuth } from '../compose-auth';
import { csrfProtection } from '../csrf-protection';
import type { AuthUser } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRoleApp(role: string, user?: AuthUser) {
  const app = new Hono();
  if (user) app.use('*', (c, next) => { c.set('user', user); return next(); });
  app.use('/test', requireRole(role));
  app.get('/test', (c) => c.json({ ok: true }));
  return app;
}

function buildPermissionApp(permission: string, user?: AuthUser) {
  const app = new Hono();
  if (user) app.use('*', (c, next) => { c.set('user', user); return next(); });
  app.use('/test', requirePermission(permission));
  app.get('/test', (c) => c.json({ ok: true }));
  return app;
}

// ---------------------------------------------------------------------------
// requireRole
// ---------------------------------------------------------------------------

describe('requireRole', () => {
  it('returns 401 when no user is set', async () => {
    const app = buildRoleApp('admin');
    const res = await app.request('/test');
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when user role does not match', async () => {
    const app = buildRoleApp('admin', { id: 'u1', role: 'user' });
    const res = await app.request('/test');
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
  });

  it('calls next when user role matches', async () => {
    const app = buildRoleApp('admin', { id: 'u1', role: 'admin' });
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  it('returns 403 when user has no role property', async () => {
    const app = buildRoleApp('admin', { id: 'u1' });
    const res = await app.request('/test');
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// requirePermission
// ---------------------------------------------------------------------------

describe('requirePermission', () => {
  it('returns 401 when no user is set', async () => {
    const app = buildPermissionApp('read:users');
    const res = await app.request('/test');
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when user lacks the permission', async () => {
    const app = buildPermissionApp('write:users', { id: 'u1', permissions: ['read:users'] });
    const res = await app.request('/test');
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
  });

  it('calls next when user has the permission', async () => {
    const app = buildPermissionApp('read:users', { id: 'u1', permissions: ['read:users', 'write:users'] });
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  it('returns 403 when user has no permissions array', async () => {
    const app = buildPermissionApp('read:users', { id: 'u1' });
    const res = await app.request('/test');
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// composeAuth
// ---------------------------------------------------------------------------

describe('composeAuth', () => {
  it('returns 401 when all strategies fail', async () => {
    const app = new Hono();
    const alwaysFail = composeAuth(
      async (_c, _next) => {},  // doesn't call next, doesn't set user
    );
    app.use('/test', alwaysFail);
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('calls next when the first strategy succeeds', async () => {
    const app = new Hono();
    const firstSucceeds = composeAuth(
      async (c, next) => { c.set('user', { id: 'u1' }); await next(); },
      async (_c, _next) => { throw new Error('should not be called'); },
    );
    app.use('/test', firstSucceeds);
    app.get('/test', (c) => c.json({ userId: c.var.user?.id }));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect((await res.json()).userId).toBe('u1');
  });

  it('falls through to the second strategy when the first does not set user', async () => {
    const app = new Hono();
    const secondSucceeds = composeAuth(
      async (_c, next) => { await next(); },  // calls next but no user set → skip
      async (c, next) => { c.set('user', { id: 'u2' }); await next(); },
    );
    app.use('/test', secondSucceeds);
    app.get('/test', (c) => c.json({ userId: c.var.user?.id }));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect((await res.json()).userId).toBe('u2');
  });
});

// ---------------------------------------------------------------------------
// csrfProtection
// ---------------------------------------------------------------------------

describe('csrfProtection', () => {
  function buildCsrfApp(token: string) {
    const app = new Hono();
    app.use('/test', csrfProtection({ getToken: () => token }));
    app.get('/test', (c) => c.json({ method: 'GET' }));
    app.post('/test', (c) => c.json({ method: 'POST' }));
    app.put('/test', (c) => c.json({ method: 'PUT' }));
    app.delete('/test', (c) => c.json({ method: 'DELETE' }));
    return app;
  }

  it('passes GET requests without any token', async () => {
    const app = buildCsrfApp('secret');
    const res = await app.request('/test', { method: 'GET' });
    expect(res.status).toBe(200);
  });

  it('returns 403 for POST without X-CSRF-Token header', async () => {
    const app = buildCsrfApp('secret');
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
  });

  it('returns 403 for POST with wrong X-CSRF-Token', async () => {
    const app = buildCsrfApp('secret');
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'X-CSRF-Token': 'wrong' },
    });
    expect(res.status).toBe(403);
  });

  it('passes POST with correct X-CSRF-Token', async () => {
    const app = buildCsrfApp('secret');
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'X-CSRF-Token': 'secret' },
    });
    expect(res.status).toBe(200);
  });

  it('protects PUT and DELETE too', async () => {
    const app = buildCsrfApp('token');
    const put = await app.request('/test', { method: 'PUT' });
    const del = await app.request('/test', { method: 'DELETE' });
    expect(put.status).toBe(403);
    expect(del.status).toBe(403);
  });

  it('reads from a custom header name when configured', async () => {
    const app = new Hono();
    app.use('/test', csrfProtection({ getToken: () => 'tok', headerName: 'X-My-CSRF' }));
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'X-My-CSRF': 'tok' },
    });
    expect(res.status).toBe(200);
  });

  it('supports async getToken()', async () => {
    const app = new Hono();
    app.use('/test', csrfProtection({ getToken: async () => 'async-token' }));
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'X-CSRF-Token': 'async-token' },
    });
    expect(res.status).toBe(200);
  });
});
