import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sessionAuth } from '../session-auth';
import type { AuthAdapter, RequestContext, SessionValidationResult } from '@web-loom/api-core';

function createMockAdapter(overrides: Partial<AuthAdapter> = {}): AuthAdapter {
  return {
    createSession: vi.fn(),
    validateSession: vi.fn(),
    invalidateSession: vi.fn(),
    createUser: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn(),
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    getOAuthAuthorizationUrl: vi.fn(),
    handleOAuthCallback: vi.fn(),
    createApiKey: vi.fn(),
    validateApiKey: vi.fn(),
    revokeApiKey: vi.fn(),
    ...overrides,
  } as AuthAdapter;
}

function createCtx(headers: Record<string, string> = {}): RequestContext {
  const h = new Headers(headers);
  return {
    request: new Request('http://localhost/test', { headers: h }),
    params: {},
    query: {},
    body: {},
    metadata: new Map(),
  };
}

describe('sessionAuth', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn(() => Promise.resolve(new Response('OK')));
  });

  it('should return 401 when no Authorization header is present', async () => {
    const adapter = createMockAdapter();
    const middleware = sessionAuth(adapter);
    const response = await middleware(createCtx(), next);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe('UNAUTHORIZED');
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when token prefix does not match', async () => {
    const adapter = createMockAdapter();
    const middleware = sessionAuth(adapter);
    const response = await middleware(createCtx({ Authorization: 'ApiKey abc123' }), next);

    expect(response.status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when session is invalid', async () => {
    const adapter = createMockAdapter({
      validateSession: vi.fn().mockResolvedValue({ valid: false } satisfies SessionValidationResult),
    });
    const middleware = sessionAuth(adapter);
    const response = await middleware(createCtx({ Authorization: 'Bearer token123' }), next);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe('INVALID_TOKEN');
    expect(next).not.toHaveBeenCalled();
  });

  it('should attach user and session to context on valid session', async () => {
    const mockUser = { id: 'u1', email: 'test@example.com', role: 'user' };
    const mockSession = { id: 's1', userId: 'u1', expiresAt: new Date(), attributes: {} };
    const adapter = createMockAdapter({
      validateSession: vi.fn().mockResolvedValue({
        valid: true,
        user: mockUser,
        session: mockSession,
      } satisfies SessionValidationResult),
    });

    const ctx = createCtx({ Authorization: 'Bearer valid-token' });
    const middleware = sessionAuth(adapter);
    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.user).toMatchObject({ id: 'u1', email: 'test@example.com', authMethod: 'session' });
    expect(ctx.session).toBe(mockSession);
  });

  it('should pass through when optional and no token', async () => {
    const adapter = createMockAdapter();
    const middleware = sessionAuth(adapter, { optional: true });
    const ctx = createCtx();
    const response = await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.user).toBeUndefined();
    expect(response).toBeDefined();
  });

  it('should pass through when optional and session is invalid', async () => {
    const adapter = createMockAdapter({
      validateSession: vi.fn().mockResolvedValue({ valid: false }),
    });
    const middleware = sessionAuth(adapter, { optional: true });
    const ctx = createCtx({ Authorization: 'Bearer bad-token' });
    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.user).toBeUndefined();
  });

  it('should support custom header name and token prefix', async () => {
    const mockUser = { id: 'u1', email: 'a@b.com' };
    const mockSession = { id: 's1', userId: 'u1', expiresAt: new Date(), attributes: {} };
    const adapter = createMockAdapter({
      validateSession: vi.fn().mockResolvedValue({ valid: true, user: mockUser, session: mockSession }),
    });

    const middleware = sessionAuth(adapter, { headerName: 'X-Session', tokenPrefix: 'Token' });
    const ctx = createCtx({ 'X-Session': 'Token my-session-id' });
    await middleware(ctx, next);

    expect(adapter.validateSession).toHaveBeenCalledWith('my-session-id');
    expect(next).toHaveBeenCalled();
  });
});
