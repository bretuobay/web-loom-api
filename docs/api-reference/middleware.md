# API Reference: Middleware Packages

## @web-loom/api-middleware-auth

Authentication and authorization middleware.

### `authenticate`

Validates the session token and attaches user context. Returns HTTP 401 if the session is invalid or expired.

```typescript
import { authenticate } from "@web-loom/api-middleware-auth";

router.get("/api/profile", {
  middleware: [authenticate],
  handler: async (ctx) => {
    // ctx.user and ctx.session are available
    return ctx.json({ user: ctx.user });
  },
});
```

### `requireRole(role)`

Checks that the authenticated user has the specified role. Returns HTTP 403 if not. Must be used after `authenticate`.

```typescript
import { authenticate, requireRole } from "@web-loom/api-middleware-auth";

router.get("/api/admin/users", {
  middleware: [authenticate, requireRole("admin")],
  handler: async (ctx) => { /* ... */ },
});
```

### `requirePermission(permission)`

Checks that the authenticated user has a specific permission.

```typescript
import { authenticate, requirePermission } from "@web-loom/api-middleware-auth";

router.delete("/api/posts/:id", {
  middleware: [authenticate, requirePermission("posts:delete")],
  handler: async (ctx) => { /* ... */ },
});
```

### `apiKeyAuth`

Validates API keys from the `Authorization` header (`Bearer <key>`) or `X-API-Key` header.

```typescript
import { apiKeyAuth } from "@web-loom/api-middleware-auth";

router.get("/api/data", {
  middleware: [apiKeyAuth],
  handler: async (ctx) => {
    // ctx.apiKey contains key metadata and scopes
    return ctx.json({ data: "..." });
  },
});
```

---

## @web-loom/api-middleware-cors

Cross-Origin Resource Sharing middleware.

### `corsMiddleware(options?)`

Handles CORS preflight requests and adds CORS headers to responses.

```typescript
import { corsMiddleware } from "@web-loom/api-middleware-cors";

// Use global config (from defineConfig)
app.use(corsMiddleware());

// Or override per-route
app.use(corsMiddleware({
  origin: ["https://app.example.com"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  headers: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));
```

**Options:**

```typescript
interface CORSOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  credentials?: boolean;
  methods?: string[];
  headers?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
}
```

---

## @web-loom/api-middleware-rate-limit

Request rate limiting middleware.

### `rateLimitMiddleware(options)`

Enforces request rate limits per client. Returns HTTP 429 with `Retry-After` header when exceeded.

```typescript
import { rateLimitMiddleware } from "@web-loom/api-middleware-rate-limit";

// Global rate limit
app.use(rateLimitMiddleware({
  windowMs: 60_000,   // 1 minute
  max: 100,           // 100 requests per window
}));

// Stricter limit for auth endpoints
router.post("/api/auth/login", {
  middleware: [rateLimitMiddleware({ windowMs: 60_000, max: 5 })],
  handler: async (ctx) => { /* ... */ },
});
```

**Options:**

```typescript
interface RateLimitOptions {
  windowMs: number;                          // Time window in milliseconds
  max: number;                               // Max requests per window
  keyGenerator?: (ctx: RequestContext) => string;  // Custom key (default: IP)
  message?: string;                          // Custom error message
  headers?: boolean;                         // Include rate limit headers (default: true)
  skipSuccessfulRequests?: boolean;          // Only count failed requests
  skipFailedRequests?: boolean;              // Only count successful requests
}
```

**Response headers:**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1705312245
Retry-After: 30          (only when rate limited)
```

---

## @web-loom/api-middleware-validation

Request validation middleware.

### `validationMiddleware(schema)`

Validates request body, query, and params against a schema. Returns HTTP 400 with field-level errors on failure.

```typescript
import { validationMiddleware } from "@web-loom/api-middleware-validation";

router.post("/api/items", {
  middleware: [validationMiddleware({
    body: {
      name: { type: "string", required: true, minLength: 1 },
      price: { type: "number", required: true, min: 0 },
    },
  })],
  handler: async (ctx) => {
    // ctx.body is validated and typed
  },
});
```

Typically you don't use this middleware directly — the `validation` option in route definitions applies it automatically:

```typescript
router.post("/api/items", {
  validation: {
    body: Item.schema.pick("name", "price"),
  },
  handler: async (ctx) => { /* ... */ },
});
```

**Schema types:**

```typescript
interface RouteValidation {
  body?: Schema;
  query?: Schema;
  params?: Schema;
  headers?: Schema;
}
```

### Validation Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fields": [
        {
          "path": ["name"],
          "message": "Required",
          "code": "required"
        },
        {
          "path": ["price"],
          "message": "Must be greater than or equal to 0",
          "code": "too_small",
          "value": -5
        }
      ]
    }
  }
}
```

---

## Writing Custom Middleware

All middleware follows the same signature:

```typescript
import type { Middleware } from "@web-loom/api-core";

export const timing: Middleware = async (ctx, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  // Response headers can be set after next()
  ctx.request.headers.set("X-Response-Time", `${duration}ms`);
};
```

### Short-Circuit Pattern

Return a response without calling `next()` to stop the middleware chain:

```typescript
export const maintenanceMode: Middleware = async (ctx, next) => {
  if (process.env.MAINTENANCE === "true") {
    return ctx.json({ error: "Service under maintenance" }, 503);
  }
  await next();
};
```

### Composing Middleware

```typescript
import { compose } from "@web-loom/api-core";

const protectedAdmin = compose(authenticate, requireRole("admin"), rateLimitMiddleware({ max: 50 }));

router.get("/api/admin/stats", {
  middleware: [protectedAdmin],
  handler: async (ctx) => { /* ... */ },
});
```
