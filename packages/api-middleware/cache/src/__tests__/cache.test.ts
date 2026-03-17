import { describe, it, expect, beforeEach } from 'vitest';
import { cache } from '../cache';
import { MemoryCacheStore } from '../stores/memory-store';
import type { RequestContext, NextFunction } from '@web-loom/api-core';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function createContext(
  method: string,
  url: string,
  headers?: Record<string, string>,
): RequestContext {
  const reqHeaders = new Headers(headers);
  const request = new Request(url, { method, headers: reqHeaders });
  return {
    request,
    params: {},
    query: {},
    body: undefined,
    metadata: new Map(),
  };
}

function createNext(body = '{"ok":true}', status = 200): NextFunction {
  return async () =>
    new Response(body, {
      status,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    });
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('cache middleware', () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore({ cleanupIntervalMs: 0 });
  });

  it('returns X-Cache: MISS on first request', async () => {
    const mw = cache({ store });
    const ctx = createContext('GET', 'http://localhost/users');
    const res = await mw(ctx, createNext());

    expect(res.headers.get('X-Cache')).toBe('MISS');
    expect(res.status).toBe(200);
  });

  it('returns X-Cache: HIT on second request (cache hit)', async () => {
    const mw = cache({ store });
    const ctx1 = createContext('GET', 'http://localhost/users');
    await mw(ctx1, createNext());

    const ctx2 = createContext('GET', 'http://localhost/users');
    const res = await mw(ctx2, createNext());

    expect(res.headers.get('X-Cache')).toBe('HIT');
    const body = await res.text();
    expect(body).toBe('{"ok":true}');
  });

  it('does not cache non-GET methods by default', async () => {
    const mw = cache({ store });
    const ctx = createContext('POST', 'http://localhost/users');
    const res = await mw(ctx, createNext());

    // POST with autoInvalidate triggers invalidation path, still MISS
    expect(res.headers.get('X-Cache')).toBe('MISS');
    expect(store.size).toBe(0);
  });

  it('supports configurable TTL', async () => {
    const mw = cache({ store, ttl: 50 });
    const ctx1 = createContext('GET', 'http://localhost/data');
    await mw(ctx1, createNext());

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 80));

    const ctx2 = createContext('GET', 'http://localhost/data');
    const res = await mw(ctx2, createNext('{"fresh":true}'));

    expect(res.headers.get('X-Cache')).toBe('MISS');
    const body = await res.text();
    expect(body).toBe('{"fresh":true}');
  });

  it('generates different cache keys for different URLs', async () => {
    const mw = cache({ store });

    const ctx1 = createContext('GET', 'http://localhost/users');
    await mw(ctx1, createNext('{"users":true}'));

    const ctx2 = createContext('GET', 'http://localhost/posts');
    const res = await mw(ctx2, createNext('{"posts":true}'));

    expect(res.headers.get('X-Cache')).toBe('MISS');
    const body = await res.text();
    expect(body).toBe('{"posts":true}');
  });

  it('includes vary headers in cache key', async () => {
    const mw = cache({ store, varyHeaders: ['Accept-Language'] });

    const ctx1 = createContext('GET', 'http://localhost/data', {
      'Accept-Language': 'en',
    });
    await mw(ctx1, createNext('{"lang":"en"}'));

    const ctx2 = createContext('GET', 'http://localhost/data', {
      'Accept-Language': 'fr',
    });
    const res = await mw(ctx2, createNext('{"lang":"fr"}'));

    // Different vary header = different cache key = MISS
    expect(res.headers.get('X-Cache')).toBe('MISS');
    const body = await res.text();
    expect(body).toBe('{"lang":"fr"}');
  });

  it('auto-invalidates cache on mutation (POST)', async () => {
    const mw = cache({ store });

    // Populate cache
    const ctx1 = createContext('GET', 'http://localhost/users');
    await mw(ctx1, createNext('{"cached":true}'));

    // Mutation should invalidate
    const ctxPost = createContext('POST', 'http://localhost/users');
    await mw(ctxPost, createNext('{"created":true}'));

    // Next GET should be a MISS
    const ctx2 = createContext('GET', 'http://localhost/users');
    const res = await mw(ctx2, createNext('{"fresh":true}'));

    expect(res.headers.get('X-Cache')).toBe('MISS');
  });

  it('respects Cache-Control: no-store', async () => {
    const mw = cache({ store });

    const ctx = createContext('GET', 'http://localhost/data', {
      'Cache-Control': 'no-store',
    });
    const res = await mw(ctx, createNext());

    expect(res.headers.get('X-Cache')).toBe('MISS');
    expect(store.size).toBe(0);
  });

  it('respects Cache-Control: no-cache (skips lookup, still stores)', async () => {
    const mw = cache({ store });

    // First request populates cache
    const ctx1 = createContext('GET', 'http://localhost/data');
    await mw(ctx1, createNext('{"v":1}'));

    // no-cache request should bypass cache but still store
    const ctx2 = createContext('GET', 'http://localhost/data', {
      'Cache-Control': 'no-cache',
    });
    const res = await mw(ctx2, createNext('{"v":2}'));

    expect(res.headers.get('X-Cache')).toBe('MISS');
    const body = await res.text();
    expect(body).toBe('{"v":2}');
  });

  it('only caches configured status codes', async () => {
    const mw = cache({ store, cacheableStatuses: [200] });

    const ctx1 = createContext('GET', 'http://localhost/missing');
    await mw(ctx1, createNext('Not Found', 404));

    // Should not be cached
    const ctx2 = createContext('GET', 'http://localhost/missing');
    const res = await mw(ctx2, createNext('Still Not Found', 404));

    expect(res.headers.get('X-Cache')).toBe('MISS');
  });

  it('supports stale-while-revalidate', async () => {
    const mw = cache({ store, ttl: 50, staleWhileRevalidate: 5000 });

    const ctx1 = createContext('GET', 'http://localhost/data');
    await mw(ctx1, createNext('{"stale":false}'));

    // Wait for TTL to expire but within SWR window
    await new Promise((r) => setTimeout(r, 80));

    const ctx2 = createContext('GET', 'http://localhost/data');
    const res = await mw(ctx2, createNext('{"stale":false,"fresh":true}'));

    // Should serve stale content
    expect(res.headers.get('X-Cache')).toBe('STALE');
    const body = await res.text();
    expect(body).toBe('{"stale":false}');
  });
});
