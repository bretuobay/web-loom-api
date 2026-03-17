/**
 * @web-loom/api-middleware-rate-limit
 *
 * Token-bucket rate limiting middleware for Web Loom API Framework.
 * Supports per-IP, per-user, and custom key strategies with pluggable
 * storage backends (in-memory for development, Redis for production).
 */

// Middleware
export { rateLimit } from './rate-limit';

// Storage backends
export { MemoryRateLimitStore } from './stores/memory-store';
export { RedisRateLimitStore } from './stores/redis-store';

// Types
export type {
  RateLimitOptions,
  RateLimitStore,
  RateLimitInfo,
  TokenBucketState,
  TimeWindow,
  KeyStrategy,
} from './types';
export { TIME_WINDOW_MS } from './types';
export type { MemoryStoreOptions } from './stores/memory-store';
export type { RedisClient, RedisStoreOptions } from './stores/redis-store';
