import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiKeyAuth } from '../api-key-auth';
import type { AuthAdapter, RequestContext, ApiKeyValidationResult } from '@web-loom/api-core';

function createMockAdapter(overrides: Partial<AuthAdapter> = {}): AuthAdapter {
  return {
    createSession: vi.fn(),
    validateSession: vi.fn(),
    invalidateSession: vi.fn(),
    createUser: vi.fn(),
    getUser: vi.fn().mockResolvedValue(null),
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

describe('apiKeyAuth', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn(() => Promise.resolve(new Response('OK')));
  });

  it('should return 401 when no API key header is present', async () => {
    const adapter = createMockAdapter();
    const middleware = apiKeyAuth(adapter);
    const response = await middleware(createCtx(), next);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe('UNAUTHORIZED');
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when API key is invalid', async () => {
    const adapter = createMockAdapter({
      validateApiKey: vi.fn().mockResolvedValue({ valid: false } satisfies ApiKeyValidationResult),
    });
    const middleware = apiKeyAuth(adapter);
    const response = await middleware(createCtx({ Authorization: 'ApiKey bad-key' }), next);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe('INVALID_TOKEN');
    expect(next).not.toHaveBeenCalled();
  });

  it('should attach user to context on valid API key', async () => {
    const adapter = createMockAdapter({
      validateApiKey: vi.fn().mockResolvedValue({
        valid: true,
        userId: 'u1',
        scopes: ['read:users'],
      } satisfies ApiKeyValidationResult),
      getUser: vi.fn().mockResolvedValue({ id: 'u1', email: 'test@example.com', role: 'user' }),
    });

    const ctx = createCtx({ Authorization: 'ApiKey wl_valid123' });
    const middleware = apiKeyAuth(adapter);
    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.user).toMatchObject({
      id: 'u1',
      email: 'test@example.com',
      scopes: ['read:users'],
      authMethod: 'apikey',
    });
  });

  it('should return 403 when required scopes are missing', async () => {
    const adapter = createMockAdapter({
      validateApiKey: vi.fn().mockResolvedValue({
        valid: true,
        userId: 'u1',
        scopes: ['read:users'],
      }),
    });

    const middleware = apiKeyAuth(adapter, { requiredScopes: ['write:users'] });
    const response = await middleware(createCtx({ Authorization: 'ApiKey wl_key' }), next);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('INSUFFICIENT_PERMISSIONS');
    expect(body.message).toContain('write:users');
    expect(next).not.toHaveBeenCalled();
  });

  it('should pass when all required scopes are present', async () => {
    const adapter = createMockAdapter({
      validateApiKey: vi.fn().mockResolvedValue({
        valid: true,
        userId: 'u1',
        scopes: ['read:users', 'write:users'],
      }),
      getUser: vi.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com' }),
    });

    const middleware = apiKeyAuth(adapter, { requiredScopes: ['read:users', 'write:users'] });
    const ctx = createCtx({ Authorization: 'ApiKey wl_key' });
    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it('should pass through when optional and no key', async () => {
    const adapter = createMockAdapter();
    const middleware = apiKeyAuth(adapter, { optional: true });
    const ctx = createCtx();
    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.user).toBeUndefined();
  });

  it('should pass through when optional and key is invalid', async () => {
    const adapter = createMockAdapter({
      validateApiKey: vi.fn().mockResolvedValue({ valid: false }),
    });
    const middleware = apiKeyAuth(adapter, { optional: true });
    const ctx = createCtx({ Authorization: 'ApiKey bad' });
    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.user).toBeUndefined();
  });
});
