/**
 * Rate Limit Middleware Types
 *
 * Type definitions for rate limiting middleware, storage backends,
 * and configuration options.
 */

// ---------------------------------------------------------------------------
// Time Window
// ---------------------------------------------------------------------------

/** Supported time window units for rate limiting */
export type TimeWindow = 'second' | 'minute' | 'hour' | 'day';

/** Map of time window to duration in milliseconds */
export const TIME_WINDOW_MS: Record<TimeWindow, number> = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

// ---------------------------------------------------------------------------
// Token Bucket State
// ---------------------------------------------------------------------------

/** Internal state for a token bucket */
export interface TokenBucketState {
  /** Current number of available tokens */
  tokens: number;
  /** Timestamp (ms) of the last token refill */
  lastRefillTime: number;
}

// ---------------------------------------------------------------------------
// Rate Limit Store
// ---------------------------------------------------------------------------

/**
 * Storage backend interface for rate limit state.
 *
 * Implementations must be safe for concurrent access within a single
 * process. Distributed implementations (e.g. Redis) should use atomic
 * operations where possible.
 */
export interface RateLimitStore {
  /**
   * Retrieve the current bucket state for a key.
   * Returns `undefined` if no state exists yet.
   */
  get(key: string): Promise<TokenBucketState | undefined>;

  /**
   * Persist the bucket state for a key with an expiration time.
   *
   * @param key - Unique rate limit key
   * @param state - Token bucket state to store
   * @param ttlMs - Time-to-live in milliseconds; entries may be evicted after this
   */
  set(key: string, state: TokenBucketState, ttlMs: number): Promise<void>;

  /**
   * Remove the bucket state for a key (e.g. manual reset).
   */
  reset(key: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Rate Limit Configuration
// ---------------------------------------------------------------------------

/** Key extraction strategy */
export type KeyStrategy = 'ip' | 'user' | 'custom';

/**
 * Options for the rate limiting middleware factory.
 */
export interface RateLimitOptions {
  /** Maximum number of tokens in the bucket (burst capacity). Default: 100 */
  maxTokens?: number | undefined;

  /** Number of tokens added per time window. Default: same as maxTokens */
  refillRate?: number | undefined;

  /** Time window for token refill. Default: 'minute' */
  window?: TimeWindow | undefined;

  /** Key extraction strategy. Default: 'ip' */
  keyStrategy?: KeyStrategy | undefined;

  /**
   * Custom key extraction function.
   * Required when `keyStrategy` is `'custom'`.
   * Receives the request and should return a string key.
   */
  keyGenerator?: ((request: Request, user?: unknown) => string) | undefined;

  /** Storage backend. Default: in-memory store */
  store?: RateLimitStore | undefined;

  /** Optional prefix for storage keys to avoid collisions. Default: 'rl:' */
  keyPrefix?: string | undefined;

  /**
   * If true, rate limit failures (store errors) are silently ignored
   * and the request is allowed through. Default: false
   */
  failOpen?: boolean | undefined;

  /**
   * Custom message returned in the 429 response body.
   * Default: 'Too Many Requests'
   */
  message?: string | undefined;
}

/** Resolved (non-optional) configuration used internally */
export interface ResolvedRateLimitOptions {
  maxTokens: number;
  refillRate: number;
  window: TimeWindow;
  windowMs: number;
  keyStrategy: KeyStrategy;
  keyGenerator: (request: Request, user?: unknown) => string;
  store: RateLimitStore;
  keyPrefix: string;
  failOpen: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Rate Limit Result (exposed on RequestContext metadata)
// ---------------------------------------------------------------------------

/** Information about the current rate limit state for a request */
export interface RateLimitInfo {
  /** Maximum tokens (burst capacity) */
  limit: number;
  /** Tokens remaining after this request */
  remaining: number;
  /** Unix timestamp (seconds) when the bucket fully refills */
  reset: number;
  /** Seconds until the next token is available (only set when limited) */
  retryAfter?: number | undefined;
}
