import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRateLimitStore } from '../stores/memory-store';
import { RedisRateLimitStore } from '../stores/redis-store';
import type { TokenBucketState } from '../types';

// ---------------------------------------------------------------------------
// MemoryRateLimitStore
// ---------------------------------------------------------------------------

describe('MemoryRateLimitStore', () => {
  let store: MemoryRateLimitStore;

  afterEach(() => {
    store?.destroy();
  });

  it('returns undefined for unknown keys', async () => {
    store = new MemoryRateLimitStore({ cleanupIntervalMs: 0 });
    expect(await store.get('nonexistent')).toBeUndefined();
  });

  it('stores and retrieves bucket state', async () => {
    store = new MemoryRateLimitStore({ cleanupIntervalMs: 0 });
    const state: TokenBucketState = { tokens: 5, lastRefillTime: Date.now() };

    await store.set('key1', state, 60_000);
    const result = await store.get('key1');

    expect(result).toEqual(state);
  });

  it('respects TTL expiration', async () => {
    vi.useFakeTimers();
    store = new MemoryRateLimitStore({ cleanupIntervalMs: 0 });

    const state: TokenBucketState = { tokens: 5, lastRefillTime: Date.now() };
    await store.set('key1', state, 1000); // 1 second TTL

    expect(await store.get('key1')).toEqual(state);

    vi.advanceTimersByTime(1001);

    expect(await store.get('key1')).toBeUndefined();
    vi.useRealTimers();
  });

  it('resets a key', async () => {
    store = new MemoryRateLimitStore({ cleanupIntervalMs: 0 });
    const state: TokenBucketState = { tokens: 5, lastRefillTime: Date.now() };

    await store.set('key1', state, 60_000);
    await store.reset('key1');

    expect(await store.get('key1')).toBeUndefined();
  });

  it('cleanup removes expired entries', async () => {
    vi.useFakeTimers();
    store = new MemoryRateLimitStore({ cleanupIntervalMs: 0 });

    await store.set('a', { tokens: 1, lastRefillTime: Date.now() }, 500);
    await store.set('b', { tokens: 2, lastRefillTime: Date.now() }, 60_000);

    vi.advanceTimersByTime(600);
    store.cleanup();

    expect(store.size).toBe(1);
    expect(await store.get('a')).toBeUndefined();
    expect(await store.get('b')).toBeDefined();

    vi.useRealTimers();
  });

  it('destroy clears all entries and stops timer', () => {
    store = new MemoryRateLimitStore({ cleanupIntervalMs: 100 });
    store.destroy();
    expect(store.size).toBe(0);
  });

  it('reports size correctly', async () => {
    store = new MemoryRateLimitStore({ cleanupIntervalMs: 0 });
    expect(store.size).toBe(0);

    await store.set('a', { tokens: 1, lastRefillTime: Date.now() }, 60_000);
    expect(store.size).toBe(1);

    await store.set('b', { tokens: 2, lastRefillTime: Date.now() }, 60_000);
    expect(store.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// RedisRateLimitStore (mock)
// ---------------------------------------------------------------------------

describe('RedisRateLimitStore (mock)', () => {
  it('returns undefined for unknown keys', async () => {
    const store = RedisRateLimitStore.createMock();
    expect(await store.get('nonexistent')).toBeUndefined();
  });

  it('stores and retrieves bucket state', async () => {
    const store = RedisRateLimitStore.createMock();
    const state: TokenBucketState = { tokens: 10, lastRefillTime: Date.now() };

    await store.set('key1', state, 60_000);
    const result = await store.get('key1');

    expect(result).toEqual(state);
  });

  it('resets a key', async () => {
    const store = RedisRateLimitStore.createMock();
    const state: TokenBucketState = { tokens: 10, lastRefillTime: Date.now() };

    await store.set('key1', state, 60_000);
    await store.reset('key1');

    expect(await store.get('key1')).toBeUndefined();
  });

  it('handles invalid JSON gracefully', async () => {
    // Create a store with a client that returns invalid JSON
    const mockClient = {
      get: async () => 'not-json',
      set: async () => 'OK' as unknown,
      del: async () => 1 as unknown,
    };
    const store = new RedisRateLimitStore({ client: mockClient });

    expect(await store.get('key1')).toBeUndefined();
  });
});
