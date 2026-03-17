/**
 * In-Memory Cache Store
 *
 * Simple Map-based storage backend suitable for single-process / development use.
 * Automatically cleans up expired entries on a configurable interval.
 *
 * @example
 * ```typescript
 * import { MemoryCacheStore } from '@web-loom/api-middleware-cache';
 *
 * const store = new MemoryCacheStore({ cleanupIntervalMs: 60_000 });
 * ```
 */

import type { CacheStore, CachedResponse } from '../types';

interface StoredEntry {
  entry: CachedResponse;
  expiresAt: number;
}

export interface MemoryCacheStoreOptions {
  /**
   * How often (ms) to sweep expired entries.
   * Set to 0 to disable automatic cleanup.
   * Default: 60_000 (1 minute)
   */
  cleanupIntervalMs?: number | undefined;
}

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, StoredEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: MemoryCacheStoreOptions = {}) {
    const interval = options.cleanupIntervalMs ?? 60_000;
    if (interval > 0) {
      this.cleanupTimer = setInterval(() => this.cleanup(), interval);
      if (typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
        this.cleanupTimer.unref();
      }
    }
  }

  async get(key: string): Promise<CachedResponse | undefined> {
    const stored = this.entries.get(key);
    if (!stored) return undefined;

    if (Date.now() >= stored.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }

    return stored.entry;
  }

  async set(key: string, entry: CachedResponse, ttlMs: number): Promise<void> {
    this.entries.set(key, {
      entry,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      this.entries.clear();
      return;
    }

    for (const key of this.entries.keys()) {
      if (key.startsWith(pattern)) {
        this.entries.delete(key);
      }
    }
  }

  /** Remove all expired entries */
  cleanup(): void {
    const now = Date.now();
    for (const [key, stored] of this.entries) {
      if (now >= stored.expiresAt) {
        this.entries.delete(key);
      }
    }
  }

  /** Stop the automatic cleanup timer and clear all entries */
  destroy(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.entries.clear();
  }

  /** Number of entries currently stored (useful for testing) */
  get size(): number {
    return this.entries.size;
  }
}
