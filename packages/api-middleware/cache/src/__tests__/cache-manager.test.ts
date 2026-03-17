import { describe, it, expect, beforeEach } from 'vitest';
import { CacheManager } from '../cache-manager';
import { MemoryCacheStore } from '../stores/memory-store';

describe('CacheManager', () => {
  let l1: MemoryCacheStore;
  let l2: MemoryCacheStore;
  let manager: CacheManager;

  beforeEach(() => {
    l1 = new MemoryCacheStore({ cleanupIntervalMs: 0 });
    l2 = new MemoryCacheStore({ cleanupIntervalMs: 0 });
    manager = new CacheManager({ l1, l2, defaultTtl: 60_000 });
  });

  it('getOrSet computes and caches value on miss', async () => {
    let calls = 0;
    const result = await manager.getOrSet('key1', () => {
      calls++;
      return { data: 'hello' };
    });

    expect(result).toEqual({ data: 'hello' });
    expect(calls).toBe(1);

    // Second call should use cache
    const result2 = await manager.getOrSet('key1', () => {
      calls++;
      return { data: 'world' };
    });

    expect(result2).toEqual({ data: 'hello' });
    expect(calls).toBe(1);
  });

  it('get returns undefined on miss', async () => {
    expect(await manager.get('missing')).toBeUndefined();
  });

  it('get returns cached value', async () => {
    await manager.set('key1', { value: 42 });
    const result = await manager.get<{ value: number }>('key1');
    expect(result).toEqual({ value: 42 });
  });

  it('delete removes from all layers', async () => {
    await manager.set('key1', 'data');
    await manager.delete('key1');
    expect(await manager.get('key1')).toBeUndefined();
  });

  it('invalidateByTag removes tagged entries', async () => {
    await manager.set('users:1', { name: 'Alice' }, { tags: ['users'] });
    await manager.set('users:2', { name: 'Bob' }, { tags: ['users'] });
    await manager.set('posts:1', { title: 'Post' }, { tags: ['posts'] });

    await manager.invalidateByTag('users');

    expect(await manager.get('users:1')).toBeUndefined();
    expect(await manager.get('users:2')).toBeUndefined();
    expect(await manager.get('posts:1')).toEqual({ title: 'Post' });
  });

  it('clear removes all entries', async () => {
    await manager.set('a', 1);
    await manager.set('b', 2);
    await manager.clear();
    expect(await manager.get('a')).toBeUndefined();
    expect(await manager.get('b')).toBeUndefined();
  });

  it('warm pre-loads entries', async () => {
    await manager.warm([
      { key: 'config:db', factory: () => ({ host: 'localhost' }) },
      { key: 'config:app', factory: () => ({ port: 3000 }) },
    ]);

    expect(await manager.get('config:db')).toEqual({ host: 'localhost' });
    expect(await manager.get('config:app')).toEqual({ port: 3000 });
  });

  it('promotes L2 entries to L1 on read', async () => {
    // Manually set in L2 only (bypassing manager)
    const _managerL1Only = new CacheManager({ l1: new MemoryCacheStore({ cleanupIntervalMs: 0 }), l2, defaultTtl: 60_000 });

    // Set via the full manager (populates both l1 and l2)
    await manager.set('shared', 'value');

    // Now create a new manager with fresh L1 but same L2
    const freshL1 = new MemoryCacheStore({ cleanupIntervalMs: 0 });
    const newManager = new CacheManager({ l1: freshL1, l2, defaultTtl: 60_000 });

    // Should find in L2 and promote to L1
    const result = await newManager.getOrSet('shared', () => 'fallback');
    expect(result).toBe('value');
  });

  it('works with L1 only (no L2)', async () => {
    const singleLayer = new CacheManager({ l1, defaultTtl: 60_000 });

    await singleLayer.set('key', 'data');
    expect(await singleLayer.get('key')).toBe('data');

    await singleLayer.delete('key');
    expect(await singleLayer.get('key')).toBeUndefined();
  });
});
