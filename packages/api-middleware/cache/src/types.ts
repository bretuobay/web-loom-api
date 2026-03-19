/**
 * Cache Middleware Types
 *
 * Type definitions for response caching middleware, storage backends,
 * cache management, and configuration options.
 */

// --------------------------------------------------------------------------
// Cached Entry
// --------------------------------------------------------------------------

/** Serialized response stored in the cache */
export interface CachedResponse {
  /** HTTP status code */
  status: number;
  /** HTTP status text */
  statusText: string;
  /** Serialized response headers */
  headers: [string, string][];
  /** Response body as string */
  body: string;
  /** Timestamp (ms) when the entry was created */
  createdAt: number;
  /** Timestamp (ms) when the entry expires */
  expiresAt: number;
}

// --------------------------------------------------------------------------
// Cache Store
// --------------------------------------------------------------------------

/**
 * Storage backend interface for cached responses.
 *
 * Implementations must be safe for concurrent access within a single
 * process. Distributed implementations (e.g. Redis) should use atomic
 * operations where possible.
 */
export interface CacheStore {
  /**
   * Retrieve a cached entry by key.
   * Returns `undefined` if no entry exists or it has expired.
   */
  get(key: string): Promise<CachedResponse | undefined>;

  /**
   * Store a cached entry with a TTL.
   *
   * @param key - Cache key
   * @param entry - Cached response to store
   * @param ttlMs - Time-to-live in milliseconds
   */
  set(key: string, entry: CachedResponse, ttlMs: number): Promise<void>;

  /**
   * Delete a specific cache entry.
   */
  delete(key: string): Promise<void>;

  /**
   * Delete all entries matching a key prefix/pattern.
   */
  clear(pattern?: string): Promise<void>;
}

// --------------------------------------------------------------------------
// Cache Options
// --------------------------------------------------------------------------

/**
 * Options for the caching middleware factory.
 */
export interface CacheOptions {
  /** Default TTL in milliseconds. Default: 60_000 (1 minute) */
  ttl?: number | undefined;

  /** HTTP methods to cache. Default: ['GET'] */
  methods?: string[] | undefined;

  /**
   * Headers to include in cache key generation (Vary-like behavior).
   * Default: []
   */
  varyHeaders?: string[] | undefined;

  /** Storage backend. Default: in-memory store */
  store?: CacheStore | undefined;

  /** Optional key prefix for storage keys. Default: 'cache:' */
  keyPrefix?: string | undefined;

  /**
   * Custom cache key generator.
   * Receives the request and should return a string key.
   * Default: method + URL
   */
  keyGenerator?: ((request: Request) => string) | undefined;

  /**
   * Whether to auto-invalidate cache on mutation requests
   * (POST, PUT, PATCH, DELETE) to the same resource path.
   * Default: true
   */
  autoInvalidate?: boolean | undefined;

  /**
   * Stale-while-revalidate window in milliseconds.
   * When set, expired entries within this window are served stale
   * while a background revalidation occurs.
   * Default: 0 (disabled)
   */
  staleWhileRevalidate?: number | undefined;

  /**
   * Whether to respect Cache-Control request headers
   * (no-cache, no-store, max-age).
   * Default: true
   */
  respectCacheControl?: boolean | undefined;

  /**
   * Status codes that are cacheable.
   * Default: [200]
   */
  cacheableStatuses?: number[] | undefined;
}

/** Resolved (non-optional) configuration used internally */
export interface ResolvedCacheOptions {
  ttl: number;
  methods: string[];
  varyHeaders: string[];
  store: CacheStore;
  keyPrefix: string;
  keyGenerator: (request: Request) => string;
  autoInvalidate: boolean;
  staleWhileRevalidate: number;
  respectCacheControl: boolean;
  cacheableStatuses: number[];
}
