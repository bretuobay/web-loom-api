import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryCacheStore } from '../stores/memory-store';
import { RedisCacheStore } from '../stores/redis-store';
import type { CachedResponse } from '../types';

function createEntry(overrides?: Partial<CachedResponse>): CachedResponse {
  const now = Date.now();
  return {
    status: 200,
    statusText: 'OK',
    headers: [['content-type', 'application/json']],
    body: '{"test":true}',
    createdAt: now,
    expiresAt: now + 60_000,
    ...overrides,
  };
}

describe('MemoryCacheStore', () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore({ cleanupIntervalMs: 0 });
  });

  it('returns undefined for missing keys', async () => {
    expect(await store.get('missing')).toBeUndefined();
  });

  it('stores and retrieves entries', async () => {
    const entry = createEntry();
    await store.set('key1', entry, 60_000);
    const result = await store.get('key1');
    expect(result).toEqual(entry);
  });

  it('expires entries after TTL', async () => {
    const entry = createEntry();
    await store.set('key1', entry, 50);
    await new Promise((r) => setTimeout(r, 80));
    expect(await store.get('key1')).toBeUndefined();
  });

  it('deletes specific entries', async () => {
    await store.set('key1', createEntry(), 60_000);
    await store.set('key2', createEntry(), 60_000);
    await store.delete('key1');
    expect(await store.get('key1')).toBeUndefined();
    expect(await store.get('key2')).toBeDefined();
  });

  it('clears all entries', async () => {
    await store.set('key1', createEntry(), 60_000);
    await store.set('key2', createEntry(), 60_000);
    await store.clear();
    expect(store.size).toBe(0);
  });

  it('clears entries by prefix', async () => {
    await store.set('cache:users', createEntry(), 60_000);
    await store.set('cache:posts', createEntry(), 60_000);
    await store.set('other:data', createEntry(), 60_000);
    await store.clear('cache:');
    expect(store.size).toBe(1);
    expect(await store.get('other:data')).toBeDefined();
  });

  it('reports correct size', async () => {
    expect(store.size).toBe(0);
    await store.set('a', createEntry(), 60_000);
    expect(store.size).toBe(1);
    await store.set('b', createEntry(), 60_000);
    expect(store.size).toBe(2);
  });

  it('destroy clears entries and stops timer', () => {
    store.destroy();
    expect(store.size).toBe(0);
  });
});

describe('RedisCacheStore (mock)', () => {
  let store: RedisCacheStore;

  beforeEach(() => {
    store = RedisCacheStore.createMock();
  });

  it('returns undefined for missing keys', async () => {
    expect(await store.get('missing')).toBeUndefined();
  });

  it('stores and retrieves entries', async () => {
    const entry = createEntry();
    await store.set('key1', entry, 60_000);
    const result = await store.get('key1');
    expect(result).toEqual(entry);
  });

  it('deletes specific entries', async () => {
    await store.set('key1', createEntry(), 60_000);
    await store.delete('key1');
    expect(await store.get('key1')).toBeUndefined();
  });

  it('clears entries by pattern', async () => {
    await store.set('users:1', createEntry(), 60_000);
    await store.set('users:2', createEntry(), 60_000);
    await store.set('posts:1', createEntry(), 60_000);
    await store.clear('users');
    // After clear, users entries should be gone
    expect(await store.get('users:1')).toBeUndefined();
    expect(await store.get('users:2')).toBeUndefined();
    expect(await store.get('posts:1')).toBeDefined();
  });
});
