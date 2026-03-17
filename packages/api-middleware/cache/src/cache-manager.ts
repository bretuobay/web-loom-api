/**
 * Multi-Level Cache Manager
 *
 * Coordinates multiple cache layers (L1 in-memory + L2 Redis) for
 * query result caching, prepared statement caching, configuration caching,
 * and schema caching.
 *
 * @example
 * ```typescript
 * import { CacheManager, MemoryCacheStore, RedisCacheStore } from '@web-loom/api-middleware-cache';
 *
 * const manager = new CacheManager({
 *   l1: new MemoryCacheStore(),
 *   l2: new RedisCacheStore({ client: redis }),
 *   defaultTtl: 60_000,
 * });
 *
 * // Query result caching
 * const result = await manager.getOrSet('query:users:all', () => db.query('SELECT * FROM users'), {
 *   ttl: 30_000,
 *   tags: ['users'],
 * });
 *
 * // Invalidate by tag on write
 * await manager.invalidateByTag('users');
 * ```
 */

import type { CacheStore, CachedResponse } from './types';

// --------------------------------------------------------------------------
// Cache Manager Types
// --------------------------------------------------------------------------

export interface CacheManagerOptions {
  /** L1 cache (fast, in-memory). Required. */
  l1: CacheStore;
  /** L2 cache (shared, e.g. Redis). Optional. */
  l2?: CacheStore | undefined;
  /** Default TTL in milliseconds. Default: 60_000 */
  defaultTtl?: number | undefined;
}

export interface CacheEntryOptions {
  /** TTL in milliseconds. Overrides the default. */
  ttl?: number | undefined;
  /** Tags for group invalidation. */
  tags?: string[] | undefined;
}

/** Internal wrapper for cached values (not HTTP responses) */
interface CachedValue {
  value: string;
  tags: string[];
  createdAt: number;
  expiresAt: number;
}

// --------------------------------------------------------------------------
// Cache Manager
// --------------------------------------------------------------------------

export class CacheManager {
  private readonly l1: CacheStore;
  private readonly l2: CacheStore | undefined;
  private readonly defaultTtl: number;

  /** Maps tags to sets of cache keys for group invalidation */
  private readonly tagIndex = new Map<string, Set<string>>();

  constructor(options: CacheManagerOptions) {
    this.l1 = options.l1;
    this.l2 = options.l2;
    this.defaultTtl = options.defaultTtl ?? 60_000;
  }

  /**
   * Get a value from cache, or compute and store it.
   * Checks L1 first, then L2, then calls the factory function.
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    options?: CacheEntryOptions,
  ): Promise<T> {
    const ttl = options?.ttl ?? this.defaultTtl;
    const tags = options?.tags ?? [];

    // Try L1
    const l1Entry = await this.getRaw(this.l1, key);
    if (l1Entry) {
      return JSON.parse(l1Entry.value) as T;
    }

    // Try L2
    if (this.l2) {
      const l2Entry = await this.getRaw(this.l2, key);
      if (l2Entry) {
        // Promote to L1
        await this.setRaw(this.l1, key, l2Entry, ttl);
        return JSON.parse(l2Entry.value) as T;
      }
    }

    // Cache miss: compute value
    const value = await factory();
    const wrapped: CachedValue = {
      value: JSON.stringify(value),
      tags,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
    };

    // Store in both layers
    await this.setRaw(this.l1, key, wrapped, ttl);
    if (this.l2) {
      await this.setRaw(this.l2, key, wrapped, ttl);
    }

    // Update tag index
    for (const tag of tags) {
      let keys = this.tagIndex.get(tag);
      if (!keys) {
        keys = new Set();
        this.tagIndex.set(tag, keys);
      }
      keys.add(key);
    }

    return value;
  }

  /**
   * Get a cached value by key. Returns undefined on miss.
   */
  async get<T>(key: string): Promise<T | undefined> {
    const l1Entry = await this.getRaw(this.l1, key);
    if (l1Entry) {
      return JSON.parse(l1Entry.value) as T;
    }

    if (this.l2) {
      const l2Entry = await this.getRaw(this.l2, key);
      if (l2Entry) {
        return JSON.parse(l2Entry.value) as T;
      }
    }

    return undefined;
  }

  /**
   * Manually set a value in all cache layers.
   */
  async set<T>(key: string, value: T, options?: CacheEntryOptions): Promise<void> {
    const ttl = options?.ttl ?? this.defaultTtl;
    const tags = options?.tags ?? [];

    const wrapped: CachedValue = {
      value: JSON.stringify(value),
      tags,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
    };

    await this.setRaw(this.l1, key, wrapped, ttl);
    if (this.l2) {
      await this.setRaw(this.l2, key, wrapped, ttl);
    }

    for (const tag of tags) {
      let keys = this.tagIndex.get(tag);
      if (!keys) {
        keys = new Set();
        this.tagIndex.set(tag, keys);
      }
      keys.add(key);
    }
  }

  /**
   * Delete a specific key from all cache layers.
   */
  async delete(key: string): Promise<void> {
    await this.l1.delete(key);
    if (this.l2) {
      await this.l2.delete(key);
    }
  }

  /**
   * Invalidate all entries associated with a tag.
   */
  async invalidateByTag(tag: string): Promise<void> {
    const keys = this.tagIndex.get(tag);
    if (!keys) return;

    const promises: Promise<void>[] = [];
    for (const key of keys) {
      promises.push(this.l1.delete(key));
      if (this.l2) {
        promises.push(this.l2.delete(key));
      }
    }

    await Promise.all(promises);
    this.tagIndex.delete(tag);
  }

  /**
   * Clear all entries from all cache layers.
   */
  async clear(): Promise<void> {
    await this.l1.clear();
    if (this.l2) {
      await this.l2.clear();
    }
    this.tagIndex.clear();
  }

  /**
   * Warm the cache by pre-loading entries.
   * Accepts an array of { key, factory, options } objects.
   */
  async warm(
    entries: Array<{
      key: string;
      factory: () => Promise<unknown> | unknown;
      options?: CacheEntryOptions;
    }>,
  ): Promise<void> {
    await Promise.all(
      entries.map((entry) => this.getOrSet(entry.key, entry.factory, entry.options)),
    );
  }

  // --- Internal helpers ---

  private async getRaw(store: CacheStore, key: string): Promise<CachedValue | undefined> {
    const entry = await store.get(key);
    if (!entry) return undefined;

    // We store CachedValue as a CachedResponse (reusing the interface)
    try {
      return JSON.parse(entry.body) as CachedValue;
    } catch {
      return undefined;
    }
  }

  private async setRaw(
    store: CacheStore,
    key: string,
    wrapped: CachedValue,
    ttlMs: number,
  ): Promise<void> {
    // Wrap CachedValue inside CachedResponse shape for store compatibility
    const entry: CachedResponse = {
      status: 200,
      statusText: 'OK',
      headers: [],
      body: JSON.stringify(wrapped),
      createdAt: wrapped.createdAt,
      expiresAt: wrapped.expiresAt,
    };
    await store.set(key, entry, ttlMs);
  }
}
