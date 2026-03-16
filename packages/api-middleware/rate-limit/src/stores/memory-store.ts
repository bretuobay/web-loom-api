/**
 * In-Memory Rate Limit Store
 *
 * Simple Map-based storage backend suitable for single-process / development use.
 * Automatically cleans up expired entries on a configurable interval.
 *
 * @example
 * ```typescript
 * import { MemoryRateLimitStore } from '@web-loom/api-middleware-rate-limit';
 *
 * const store = new MemoryRateLimitStore({ cleanupIntervalMs: 60_000 });
 * ```
 */

import type { RateLimitStore, TokenBucketState } from '../types';

interface StoredEntry {
  state: TokenBucketState;
  expiresAt: number;
}

export interface MemoryStoreOptions {
  /**
   * How often (ms) to sweep expired entries.
   * Set to 0 to disable automatic cleanup.
   * Default: 60 000 (1 minute)
   */
  cleanupIntervalMs?: number | undefined;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, StoredEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: MemoryStoreOptions = {}) {
    const interval = options.cleanupIntervalMs ?? 60_000;
    if (interval > 0) {
      this.cleanupTimer = setInterval(() => this.cleanup(), interval);
      // Allow the process to exit even if the timer is still running
      if (typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
        this.cleanupTimer.unref();
      }
    }
  }

  async get(key: string): Promise<TokenBucketState | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.state;
  }

  async set(key: string, state: TokenBucketState, ttlMs: number): Promise<void> {
    this.entries.set(key, {
      state,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async reset(key: string): Promise<void> {
    this.entries.delete(key);
  }

  /** Remove all expired entries */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now >= entry.expiresAt) {
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
