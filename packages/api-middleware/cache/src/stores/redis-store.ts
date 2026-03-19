/**
 * Redis Cache Store (Interface + Stub)
 *
 * Defines the contract for a Redis-backed cache store suitable for
 * distributed / production deployments. The actual Redis integration is
 * deferred — this module provides the interface and a mock implementation
 * for testing.
 *
 * @example
 * ```typescript
 * import { RedisCacheStore } from '@web-loom/api-middleware-cache';
 *
 * // Production: provide a real Redis client
 * const store = new RedisCacheStore({ client: redisClient });
 *
 * // Testing: use the built-in mock
 * const store = RedisCacheStore.createMock();
 * ```
 */

import type { CacheStore, CachedResponse } from '../types';

/**
 * Minimal Redis client interface.
 *
 * Any Redis library that exposes these methods (e.g. ioredis, @upstash/redis)
 * can be used as the backing client.
 */
export interface RedisCacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string | string[]): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

export interface RedisCacheStoreOptions {
  /** Redis client instance */
  client: RedisCacheClient;
  /** Optional key prefix (default: 'cache:') */
  keyPrefix?: string | undefined;
}

export class RedisCacheStore implements CacheStore {
  private readonly client: RedisCacheClient;
  private readonly prefix: string;

  constructor(options: RedisCacheStoreOptions) {
    this.client = options.client;
    this.prefix = options.keyPrefix ?? 'cache:';
  }

  async get(key: string): Promise<CachedResponse | undefined> {
    const raw = await this.client.get(this.prefix + key);
    if (!raw) return undefined;

    try {
      return JSON.parse(raw) as CachedResponse;
    } catch {
      return undefined;
    }
  }

  async set(key: string, entry: CachedResponse, ttlMs: number): Promise<void> {
    const ttlSeconds = Math.ceil(ttlMs / 1000);
    await this.client.set(this.prefix + key, JSON.stringify(entry), 'EX', ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(this.prefix + key);
  }

  async clear(pattern?: string): Promise<void> {
    const searchPattern = pattern ? this.prefix + pattern + '*' : this.prefix + '*';
    const keys = await this.client.keys(searchPattern);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  /**
   * Create a mock Redis cache store backed by an in-memory Map.
   * Useful for testing without a real Redis connection.
   */
  static createMock(): RedisCacheStore {
    const data = new Map<string, { value: string; expiresAt: number }>();

    const mockClient: RedisCacheClient = {
      async get(key: string): Promise<string | null> {
        const entry = data.get(key);
        if (!entry) return null;
        if (Date.now() >= entry.expiresAt) {
          data.delete(key);
          return null;
        }
        return entry.value;
      },
      async set(key: string, value: string, ..._args: unknown[]): Promise<string> {
        let ttlSeconds = 0;
        for (let i = 0; i < _args.length - 1; i++) {
          if (_args[i] === 'EX' && typeof _args[i + 1] === 'number') {
            ttlSeconds = _args[i + 1] as number;
          }
        }
        data.set(key, {
          value,
          expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : Infinity,
        });
        return 'OK';
      },
      async del(key: string | string[]): Promise<number> {
        const keys = Array.isArray(key) ? key : [key];
        let count = 0;
        for (const k of keys) {
          if (data.delete(k)) count++;
        }
        return count;
      },
      async keys(pattern: string): Promise<string[]> {
        // Simple prefix-based matching (strip trailing *)
        const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
        const result: string[] = [];
        for (const k of data.keys()) {
          if (k.startsWith(prefix)) {
            const entry = data.get(k);
            if (entry && Date.now() < entry.expiresAt) {
              result.push(k);
            }
          }
        }
        return result;
      },
    };

    return new RedisCacheStore({ client: mockClient });
  }
}
