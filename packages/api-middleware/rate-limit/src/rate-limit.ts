/**
 * Rate Limiting Middleware
 *
 * Token-bucket rate limiter that supports per-IP, per-user, and custom key
 * extraction strategies. Returns HTTP 429 with standard rate limit headers
 * when the limit is exceeded.
 *
 * @example
 * ```typescript
 * import { rateLimit } from '@web-loom/api-middleware-rate-limit';
 *
 * // 100 requests per minute per IP (defaults)
 * app.use(rateLimit());
 *
 * // 10 requests per second per user
 * app.use(rateLimit({
 *   maxTokens: 10,
 *   window: 'second',
 *   keyStrategy: 'user',
 * }));
 *
 * // Custom key + Redis store
 * app.use(rateLimit({
 *   maxTokens: 50,
 *   window: 'hour',
 *   keyStrategy: 'custom',
 *   keyGenerator: (req) => req.headers.get('X-Tenant-Id') ?? 'anonymous',
 *   store: new RedisRateLimitStore({ client: redis }),
 * }));
 * ```
 */

import type { RequestContext, NextFunction } from '@web-loom/api-core';
import type {
  RateLimitOptions,
  ResolvedRateLimitOptions,
  TokenBucketState,
  RateLimitInfo,
} from './types';
import { TIME_WINDOW_MS } from './types';
import { MemoryRateLimitStore } from './stores/memory-store';

// ---------------------------------------------------------------------------
// Key extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract the client IP address from a request.
 * Checks common proxy headers first, then falls back to 'unknown'.
 */
function extractIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

function defaultKeyGenerator(
  strategy: 'ip' | 'user',
): (request: Request, user?: unknown) => string {
  if (strategy === 'user') {
    return (_request: Request, user?: unknown) => {
      if (user && typeof user === 'object' && 'id' in user) {
        return String((user as { id: unknown }).id);
      }
      // Fall back to IP when user is not available
      return extractIp(_request);
    };
  }
  // Default: IP-based
  return (request: Request) => extractIp(request);
}

// ---------------------------------------------------------------------------
// Option resolution
// ---------------------------------------------------------------------------

function resolveOptions(opts: RateLimitOptions = {}): ResolvedRateLimitOptions {
  const window = opts.window ?? 'minute';
  const maxTokens = opts.maxTokens ?? 100;
  const keyStrategy = opts.keyStrategy ?? 'ip';

  let keyGenerator: (request: Request, user?: unknown) => string;
  if (keyStrategy === 'custom') {
    if (!opts.keyGenerator) {
      throw new Error(
        'rateLimit: keyGenerator function is required when keyStrategy is "custom"',
      );
    }
    keyGenerator = opts.keyGenerator;
  } else {
    keyGenerator = defaultKeyGenerator(keyStrategy);
  }

  return {
    maxTokens,
    refillRate: opts.refillRate ?? maxTokens,
    window,
    windowMs: TIME_WINDOW_MS[window],
    keyStrategy,
    keyGenerator,
    store: opts.store ?? new MemoryRateLimitStore(),
    keyPrefix: opts.keyPrefix ?? 'rl:',
    failOpen: opts.failOpen ?? false,
    message: opts.message ?? 'Too Many Requests',
  };
}

// ---------------------------------------------------------------------------
// Token bucket logic
// ---------------------------------------------------------------------------

/**
 * Refill tokens based on elapsed time since last refill.
 * Returns a new state (does not mutate the input).
 */
function refillBucket(
  state: TokenBucketState,
  now: number,
  config: ResolvedRateLimitOptions,
): TokenBucketState {
  const elapsed = now - state.lastRefillTime;
  if (elapsed <= 0) return state;

  // How many full windows have passed?
  const windowsPassed = elapsed / config.windowMs;
  const tokensToAdd = windowsPassed * config.refillRate;

  const newTokens = Math.min(config.maxTokens, state.tokens + tokensToAdd);

  return {
    tokens: newTokens,
    lastRefillTime: now,
  };
}

/**
 * Attempt to consume one token from the bucket.
 * Returns the updated state and whether the request is allowed.
 */
function consumeToken(
  state: TokenBucketState,
  now: number,
  config: ResolvedRateLimitOptions,
): { state: TokenBucketState; allowed: boolean; info: RateLimitInfo } {
  const refilled = refillBucket(state, now, config);

  const allowed = refilled.tokens >= 1;
  const newTokens = allowed ? refilled.tokens - 1 : refilled.tokens;

  const newState: TokenBucketState = {
    tokens: newTokens,
    lastRefillTime: refilled.lastRefillTime,
  };

  // Calculate reset time: when the bucket would be fully refilled
  const tokensNeeded = config.maxTokens - newTokens;
  const msToFull =
    tokensNeeded > 0
      ? (tokensNeeded / config.refillRate) * config.windowMs
      : 0;
  const resetTimestamp = Math.ceil((now + msToFull) / 1000);

  const info: RateLimitInfo = {
    limit: config.maxTokens,
    remaining: Math.max(0, Math.floor(newTokens)),
    reset: resetTimestamp,
  };

  if (!allowed) {
    // Time until at least 1 token is available
    const msToOneToken = ((1 - refilled.tokens) / config.refillRate) * config.windowMs;
    info.retryAfter = Math.max(1, Math.ceil(msToOneToken / 1000));
  }

  return { state: newState, allowed, info };
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Create rate limiting middleware.
 *
 * Uses a token bucket algorithm: each key starts with `maxTokens` tokens.
 * One token is consumed per request. Tokens refill at `refillRate` per
 * `window`. When tokens are exhausted the middleware returns HTTP 429.
 *
 * Standard rate limit headers are set on every response:
 * - `X-RateLimit-Limit`
 * - `X-RateLimit-Remaining`
 * - `X-RateLimit-Reset`
 * - `Retry-After` (only on 429 responses)
 *
 * @param options - Rate limit configuration
 * @returns Middleware function
 */
export function rateLimit(
  options: RateLimitOptions = {},
): (ctx: RequestContext, next: NextFunction) => Promise<Response> {
  const config = resolveOptions(options);

  return async (ctx: RequestContext, next: NextFunction): Promise<Response> => {
    const rawKey = config.keyGenerator(ctx.request, ctx.user);
    const key = config.keyPrefix + rawKey;
    const now = Date.now();

    let info: RateLimitInfo;
    let allowed: boolean;

    try {
      // Get or create bucket state
      const existing = await config.store.get(key);
      const currentState: TokenBucketState = existing ?? {
        tokens: config.maxTokens,
        lastRefillTime: now,
      };

      const result = consumeToken(currentState, now, config);
      info = result.info;
      allowed = result.allowed;

      // Persist updated state with TTL = 2× window (generous expiry)
      await config.store.set(key, result.state, config.windowMs * 2);
    } catch (err) {
      if (config.failOpen) {
        // Allow the request through on store errors
        return next();
      }
      throw err;
    }

    // Store rate limit info on the request context for downstream use
    ctx.metadata.set('rateLimit', info);

    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too Many Requests',
          message: config.message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: info.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(info.retryAfter ?? 1),
            'X-RateLimit-Limit': String(info.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(info.reset),
          },
        },
      );
    }

    // Call downstream and attach rate limit headers to the response
    const response = await next();

    // Clone headers from the original response and add rate limit headers
    const headers = new Headers(response.headers);
    headers.set('X-RateLimit-Limit', String(info.limit));
    headers.set('X-RateLimit-Remaining', String(info.remaining));
    headers.set('X-RateLimit-Reset', String(info.reset));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
