import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rateLimit } from '../rate-limit';
import { MemoryRateLimitStore } from '../stores/memory-store';
import type { RequestContext, NextFunction } from '@web-loom/api-core';
import type { RateLimitInfo, RateLimitStore, TokenBucketState } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createContext(overrides: Partial<RequestContext> = {}): RequestContext {
  const url = 'http://localhost:3000/test';
  const headers = new Headers({ 'x-forwarded-for': '1.2.3.4' });
  return {
    request: new Request(url, { headers }),
    params: {},
    query: {},
    body: undefined,
    metadata: new Map(),
    ...overrides,
  };
}

function okNext(): NextFunction {
  return async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rateLimit middleware', () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore({ cleanupIntervalMs: 0 });
  });

  afterEach(() => {
    store.destroy();
  });

  it('allows requests within the limit', async () => {
    const mw = rateLimit({ maxTokens: 5, window: 'minute', store });
    const ctx = createContext();

    const res = await mw(ctx, okNext());

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('4');
    expect(res.headers.has('X-RateLimit-Reset')).toBe(true);
  });

  it('returns 429 when tokens are exhausted', async () => {
    const mw = rateLimit({ maxTokens: 2, window: 'minute', store });
    const ctx = createContext();

    // Consume all tokens
    await mw(ctx, okNext());
    await mw(ctx, okNext());

    // Third request should be rate limited
    const res = await mw(ctx, okNext());

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res.headers.has('Retry-After')).toBe(true);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('sets Retry-After header on 429 responses', async () => {
    const mw = rateLimit({ maxTokens: 1, window: 'minute', store });
    const ctx = createContext();

    await mw(ctx, okNext()); // consume the only token
    const res = await mw(ctx, okNext());

    expect(res.status).toBe(429);
    const retryAfter = Number(res.headers.get('Retry-After'));
    expect(retryAfter).toBeGreaterThanOrEqual(1);
  });

  it('uses IP-based key extraction by default', async () => {
    const mw = rateLimit({ maxTokens: 1, window: 'minute', store });

    const ctx1 = createContext({
      request: new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '10.0.0.1' },
      }),
    });
    const ctx2 = createContext({
      request: new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '10.0.0.2' },
      }),
    });

    // Both IPs should get their own bucket
    const res1 = await mw(ctx1, okNext());
    const res2 = await mw(ctx2, okNext());

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Second request from same IP should be limited
    const res3 = await mw(ctx1, okNext());
    expect(res3.status).toBe(429);
  });

  it('supports per-user key strategy', async () => {
    const mw = rateLimit({
      maxTokens: 1,
      window: 'minute',
      keyStrategy: 'user',
      store,
    });

    const ctx1 = createContext();
    ctx1.user = { id: 'user-1', email: 'a@test.com' };

    const ctx2 = createContext();
    ctx2.user = { id: 'user-2', email: 'b@test.com' };

    const res1 = await mw(ctx1, okNext());
    const res2 = await mw(ctx2, okNext());

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Same user again → limited
    const res3 = await mw(ctx1, okNext());
    expect(res3.status).toBe(429);
  });

  it('falls back to IP when user strategy has no user', async () => {
    const mw = rateLimit({
      maxTokens: 1,
      window: 'minute',
      keyStrategy: 'user',
      store,
    });

    const ctx = createContext(); // no user set

    const res1 = await mw(ctx, okNext());
    expect(res1.status).toBe(200);

    const res2 = await mw(ctx, okNext());
    expect(res2.status).toBe(429);
  });

  it('supports custom key generator', async () => {
    const mw = rateLimit({
      maxTokens: 1,
      window: 'minute',
      keyStrategy: 'custom',
      keyGenerator: (req) => req.headers.get('X-Tenant-Id') ?? 'default',
      store,
    });

    const ctx1 = createContext({
      request: new Request('http://localhost/test', {
        headers: { 'X-Tenant-Id': 'tenant-a' },
      }),
    });
    const ctx2 = createContext({
      request: new Request('http://localhost/test', {
        headers: { 'X-Tenant-Id': 'tenant-b' },
      }),
    });

    expect((await mw(ctx1, okNext())).status).toBe(200);
    expect((await mw(ctx2, okNext())).status).toBe(200);
    expect((await mw(ctx1, okNext())).status).toBe(429);
  });

  it('throws when custom strategy has no keyGenerator', () => {
    expect(() =>
      rateLimit({ keyStrategy: 'custom', store }),
    ).toThrow('keyGenerator function is required');
  });

  it('stores rate limit info on context metadata', async () => {
    const mw = rateLimit({ maxTokens: 10, window: 'minute', store });
    const ctx = createContext();

    await mw(ctx, okNext());

    const info = ctx.metadata.get('rateLimit') as RateLimitInfo;
    expect(info).toBeDefined();
    expect(info.limit).toBe(10);
    expect(info.remaining).toBe(9);
    expect(typeof info.reset).toBe('number');
  });

  it('supports custom error message', async () => {
    const mw = rateLimit({
      maxTokens: 1,
      window: 'minute',
      message: 'Slow down!',
      store,
    });
    const ctx = createContext();

    await mw(ctx, okNext());
    const res = await mw(ctx, okNext());

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.message).toBe('Slow down!');
  });

  it('supports failOpen mode on store errors', async () => {
    const failingStore: RateLimitStore = {
      get: async () => { throw new Error('store down'); },
      set: async () => { throw new Error('store down'); },
      reset: async () => { throw new Error('store down'); },
    };

    const mw = rateLimit({ maxTokens: 1, store: failingStore, failOpen: true });
    const ctx = createContext();

    // Should pass through despite store error
    const res = await mw(ctx, okNext());
    expect(res.status).toBe(200);
  });

  it('throws on store errors when failOpen is false', async () => {
    const failingStore: RateLimitStore = {
      get: async () => { throw new Error('store down'); },
      set: async () => { throw new Error('store down'); },
      reset: async () => { throw new Error('store down'); },
    };

    const mw = rateLimit({ maxTokens: 1, store: failingStore, failOpen: false });
    const ctx = createContext();

    await expect(mw(ctx, okNext())).rejects.toThrow('store down');
  });

  it('refills tokens over time', async () => {
    vi.useFakeTimers();

    const mw = rateLimit({
      maxTokens: 2,
      refillRate: 2,
      window: 'second',
      store,
    });
    const ctx = createContext();

    // Consume both tokens
    await mw(ctx, okNext());
    await mw(ctx, okNext());
    expect((await mw(ctx, okNext())).status).toBe(429);

    // Advance 1 second → tokens should refill
    vi.advanceTimersByTime(1000);

    const res = await mw(ctx, okNext());
    expect(res.status).toBe(200);

    vi.useRealTimers();
  });
});
