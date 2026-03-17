/**
 * Redis Rate Limit Store (Interface + Stub)
 *
 * Defines the contract for a Redis-backed rate limit store suitable for
 * distributed / production deployments. The actual Redis integration is
 * deferred — this module provides the interface and a mock implementation
 * for testing.
 *
 * @example
 * ```typescript
 * import { RedisRateLimitStore } from '@web-loom/api-middleware-rate-limit';
 *
 * // Production: provide a real Redis client
 * const store = new RedisRateLimitStore({ client: redisClient });
 *
 * // Testing: use the built-in mock
 * const store = RedisRateLimitStore.createMock();
 * ```
 */

import type { RateLimitStore, TokenBucketState } from '../types';

/**
 * Minimal Redis client interface.
 *
 * Any Redis library that exposes these methods (e.g. ioredis, @upstash/redis)
 * can be used as the backing client.
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export interface RedisStoreOptions {
  /** Redis client instance */
  client: RedisClient;
  /** Optional key prefix (default: 'rl:') */
  keyPrefix?: string | undefined;
}

/**
 * Redis-backed rate limit store for distributed rate limiting.
 *
 * Stores token bucket state as JSON strings with TTL-based expiration.
 * Uses the provided Redis client for all operations.
 */
export class RedisRateLimitStore implements RateLimitStore {
  private readonly client: RedisClient;
  private readonly prefix: string;

  constructor(options: RedisStoreOptions) {
    this.client = options.client;
    this.prefix = options.keyPrefix ?? 'rl:';
  }

  async get(key: string): Promise<TokenBucketState | undefined> {
    const raw = await this.client.get(this.prefix + key);
    if (!raw) return undefined;

    try {
      return JSON.parse(raw) as TokenBucketState;
    } catch {
      return undefined;
    }
  }

  async set(key: string, state: TokenBucketState, ttlMs: number): Promise<void> {
    const ttlSeconds = Math.ceil(ttlMs / 1000);
    await this.client.set(
      this.prefix + key,
      JSON.stringify(state),
      'EX',
      ttlSeconds,
    );
  }

  async reset(key: string): Promise<void> {
    await this.client.del(this.prefix + key);
  }

  /**
   * Create a mock Redis store backed by an in-memory Map.
   * Useful for testing without a real Redis connection.
   */
  static createMock(): RedisRateLimitStore {
    const data = new Map<string, { value: string; expiresAt: number }>();

    const mockClient: RedisClient = {
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
        // Parse EX argument
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
      async del(key: string): Promise<number> {
        return data.delete(key) ? 1 : 0;
      },
    };

    return new RedisRateLimitStore({ client: mockClient });
  }
}
