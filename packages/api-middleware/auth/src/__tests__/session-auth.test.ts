import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { sessionAuth } from '../session-auth';
import type { LuciaLike } from '../session-auth';

const MOCK_SESSION = { id: 's1' };

function makeLucia(overrides: Partial<LuciaLike> = {}): LuciaLike {
  return {
    validateSession: vi.fn().mockResolvedValue({
      session: MOCK_SESSION,
      user: { id: 'u1', email: 'test@example.com', role: 'user' },
    }),
    createSessionCookie: vi.fn().mockReturnValue({ name: 'session', value: 's1', attributes: {} }),
    createBlankSessionCookie: vi
      .fn()
      .mockReturnValue({ name: 'session', value: '', attributes: {} }),
    ...overrides,
  };
}

function buildApp(lucia: LuciaLike, cookieName?: string) {
  const app = new Hono();
  app.use('/test', sessionAuth({ lucia, cookieName }));
  app.get('/test', (c) => c.json({ userId: c.var.user?.id }));
  return app;
}

describe('sessionAuth', () => {
  it('returns 401 when no session cookie is present', async () => {
    const lucia = makeLucia();
    const app = buildApp(lucia);
    const res = await app.request('/test');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when lucia returns no session', async () => {
    const lucia = makeLucia({
      validateSession: vi.fn().mockResolvedValue({ session: null, user: null }),
    });
    const app = buildApp(lucia);
    const res = await app.request('/test', {
      headers: { Cookie: 'session=invalid-id' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('sets c.var.user and calls next on valid session cookie', async () => {
    const lucia = makeLucia();
    const app = buildApp(lucia);
    const res = await app.request('/test', {
      headers: { Cookie: 'session=valid-session-id' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('u1');
  });

  it('refreshes the session cookie on success', async () => {
    const lucia = makeLucia();
    const app = buildApp(lucia);
    const res = await app.request('/test', {
      headers: { Cookie: 'session=valid-session-id' },
    });
    expect(lucia.createSessionCookie).toHaveBeenCalledWith('s1');
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toBeTruthy();
  });

  it('clears the cookie when session is invalid', async () => {
    const lucia = makeLucia({
      validateSession: vi.fn().mockResolvedValue({ session: null, user: null }),
    });
    const app = buildApp(lucia);
    const res = await app.request('/test', {
      headers: { Cookie: 'session=stale-id' },
    });
    expect(res.status).toBe(401);
    expect(lucia.createBlankSessionCookie).toHaveBeenCalled();
  });

  it('reads the custom cookie name when configured', async () => {
    const lucia = makeLucia();
    const app = buildApp(lucia, 'auth_session');
    // No auth_session cookie → 401
    const res401 = await app.request('/test', {
      headers: { Cookie: 'session=some-id' },
    });
    expect(res401.status).toBe(401);

    // Correct cookie name → 200
    const res200 = await app.request('/test', {
      headers: { Cookie: 'auth_session=valid-id' },
    });
    expect(res200.status).toBe(200);
  });

  it('uses a custom getUser mapping when provided', async () => {
    const lucia = makeLucia({
      validateSession: vi.fn().mockResolvedValue({
        session: MOCK_SESSION,
        user: { userId: 'mapped-1', emailAddress: 'mapped@example.com' },
      }),
    });
    const app = new Hono();
    app.use(
      '/test',
      sessionAuth({
        lucia,
        getUser: (u) => ({ id: String(u.userId), email: u.emailAddress as string }),
      })
    );
    app.get('/test', (c) => c.json({ userId: c.var.user?.id }));

    const res = await app.request('/test', {
      headers: { Cookie: 'session=valid-id' },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).userId).toBe('mapped-1');
  });
});
