/**
 * Vercel KV cache store integration for Web Loom API Framework
 */
import type { CacheStore, VercelKVClient } from './types';

/**
 * Cache store implementation backed by Vercel KV.
 * Implements the CacheStore interface using a Vercel KV-compatible client.
 */
export class VercelKVCacheStore implements CacheStore {
  constructor(private readonly client: VercelKVClient) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.client.get<T>(key);
    return value ?? null;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const options = ttl !== undefined ? { ex: ttl } : undefined;
    await this.client.set(key, value, options);
  }

  async delete(key: string): Promise<boolean> {
    const count = await this.client.del(key);
    return count > 0;
  }

  async has(key: string): Promise<boolean> {
    const count = await this.client.exists(key);
    return count > 0;
  }
}
