/**
 * @web-loom/api-middleware-cache
 *
 * Response caching middleware for Web Loom API Framework.
 * Supports configurable TTL, auto-invalidation, stale-while-revalidate,
 * multi-level caching (L1 + L2), and pluggable storage backends
 * (in-memory for development, Redis for production).
 */

// Middleware
export { cache } from './cache';

// Cache Manager (multi-level)
export { CacheManager } from './cache-manager';
export type { CacheManagerOptions, CacheEntryOptions } from './cache-manager';

// Storage backends
export { MemoryCacheStore } from './stores/memory-store';
export { RedisCacheStore } from './stores/redis-store';

// Types
export type { CacheOptions, CacheStore, CachedResponse } from './types';
export type { MemoryCacheStoreOptions } from './stores/memory-store';
export type { RedisCacheClient, RedisCacheStoreOptions } from './stores/redis-store';
