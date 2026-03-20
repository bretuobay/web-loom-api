# @web-loom/api-middleware-rate-limit

Token-bucket rate limiting middleware for [Web Loom API](https://github.com/bretuobay/web-loom-api). Supports per-IP, per-user, and custom key strategies with pluggable in-memory or Redis backends.

> **Note:** When using `@web-loom/api-core`, rate limiting is configured via `defineConfig({ security: { rateLimit: { ... } } })` and applied automatically. Install this package only when you need route-level or custom rate limiting.

## Installation

```bash
npm install @web-loom/api-middleware-rate-limit hono
```

For Redis backend:

```bash
npm install ioredis
```

## Usage

### Global Rate Limit

```typescript
import { rateLimit } from '@web-loom/api-middleware-rate-limit';
import { defineRoutes } from '@web-loom/api-core';

const routes = defineRoutes();

// 100 requests per minute per IP
routes.use('/*', rateLimit({ limit: 100, window: '1m' }));
```

### Per-Route Limit

```typescript
// Stricter limit on auth endpoints
routes.post('/auth/login', rateLimit({ limit: 5, window: '1m' }), loginHandler);
```

### Per-User Limit

```typescript
routes.get(
  '/api/export',
  authenticate,
  rateLimit({
    limit: 10,
    window: '1h',
    keyGenerator: (c) => c.var.user?.id ?? c.req.header('x-forwarded-for') ?? 'anon',
  }),
  exportHandler
);
```

### Redis Backend

```typescript
import { rateLimit, RedisRateLimitStore } from '@web-loom/api-middleware-rate-limit';
import Redis from 'ioredis';

const store = new RedisRateLimitStore(new Redis(process.env.REDIS_URL!));

routes.use('/*', rateLimit({ limit: 100, window: '1m', store }));
```

## Options

| Option                   | Type                            | Default   | Description                           |
| ------------------------ | ------------------------------- | --------- | ------------------------------------- |
| `limit`                  | `number`                        | required  | Max requests allowed in the window    |
| `window`                 | `'30s' \| '1m' \| '1h' \| '1d'` | required  | Time window                           |
| `keyGenerator`           | `(c: Context) => string`        | Client IP | Function to derive the rate limit key |
| `store`                  | `RateLimitStore`                | in-memory | Storage backend                       |
| `skipSuccessfulRequests` | `boolean`                       | `false`   | Only count failed requests            |
| `skipFailedRequests`     | `boolean`                       | `false`   | Only count successful requests        |

## Response Headers

When a request is rate-limited, the middleware sets:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1700000060
Retry-After: 42
```

And responds with `429 Too Many Requests`.

## License

MIT
