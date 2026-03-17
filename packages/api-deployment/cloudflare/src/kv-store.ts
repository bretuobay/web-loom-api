/**
 * Cloudflare KV cache store integration for Web Loom API Framework
 */
import type { CacheStore, KVNamespace } from './types';

/**
 * Cache store implementation backed by Cloudflare Workers KV.
 * Implements the CacheStore interface using a KV Namespace binding.
 *
 * @example
 * ```ts
 * const kv = env.CACHE as KVNamespace;
 * const store = new CloudflareKVStore(kv);
 * await store.set('user:1', { name: 'Alice' }, 3600);
 * ```
 */
export class CloudflareKVStore implements CacheStore {
  constructor(private readonly kv: KVNamespace) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.kv.get(key, { type: 'json' });
    return (value as T) ?? null;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    const options = ttl !== undefined ? { expirationTtl: ttl } : undefined;
    await this.kv.put(key, serialized, options);
  }

  async delete(key: string): Promise<boolean> {
    // KV delete doesn't return whether the key existed, so we check first
    const existing = await this.kv.get(key);
    if (existing === null) {
      return false;
    }
    await this.kv.delete(key);
    return true;
  }

  async has(key: string): Promise<boolean> {
    const value = await this.kv.get(key);
    return value !== null;
  }

  /**
   * List keys with an optional prefix filter.
   */
  async list(prefix?: string) {
    return this.kv.list(prefix ? { prefix } : undefined);
  }
}
