# API Reference: Middleware

## @web-loom/api-middleware-auth

Authentication and authorization middleware for Hono. Strategies set `c.var.user` (an `AuthUser`) on success. Guards return 401/403 if the check fails.

```bash
npm install @web-loom/api-middleware-auth
```

### `AuthUser`

```typescript
interface AuthUser {
  id: string;
  email?: string;
  role?: string;
  permissions?: string[];
  [key: string]: unknown;
}
```

Available as `c.var.user` after any successful auth strategy.

---

### `jwtAuth(options)`

Validates a Bearer JWT in the `Authorization` header.

```typescript
import { jwtAuth } from '@web-loom/api-middleware-auth';

// Protect all routes
app.use('/*', jwtAuth({ secret: process.env.JWT_SECRET! }));

// Optional auth (sets c.var.user if token present, doesn't reject if absent)
app.use('/*', jwtAuth({ secret: process.env.JWT_SECRET!, optional: true }));
```

**Options:**

```typescript
interface JwtAuthOptions {
  secret: string;
  /** When true, missing/invalid tokens don't produce a 401 (c.var.user stays undefined) */
  optional?: boolean;
  /** Validate the iss claim */
  iss?: string;
  /** Validate the aud claim */
  aud?: string | string[];
  /** Custom function to populate c.var.user from the decoded payload */
  getUser?: (payload: Record<string, unknown>) => AuthUser | Promise<AuthUser>;
}
```

---

### `sessionAuth(options)`

Cookie-based session authentication via [Lucia](https://lucia-auth.com). Validates the session cookie and refreshes it if needed.

```typescript
import { sessionAuth } from '@web-loom/api-middleware-auth';

app.use(
  '/*',
  sessionAuth({
    lucia: luciaInstance,
  })
);
```

**Options:**

```typescript
interface SessionAuthOptions {
  /** A Lucia-compatible auth instance */
  lucia: LuciaLike;
  /** Cookie name to read (default: "session") */
  cookieName?: string;
  /** When true, missing/invalid sessions don't produce a 401 */
  optional?: boolean;
}
```

---

### `apiKeyAuth(options)`

Validates API keys from `X-API-Key` header or `Authorization: Bearer <key>` fallback.

```typescript
import { apiKeyAuth } from '@web-loom/api-middleware-auth';

app.use(
  '/api/*',
  apiKeyAuth({
    validate: async (key) => {
      const record = await db.select().from(apiKeysTable).where(eq(apiKeysTable.key, key)).limit(1);
      if (!record[0]) return null;
      return { id: record[0].userId, role: 'api' };
    },
  })
);
```

**Options:**

```typescript
interface ApiKeyAuthOptions {
  /**
   * Validate a key. Return an AuthUser on success, null/undefined to reject.
   */
  validate: (key: string) => AuthUser | null | undefined | Promise<AuthUser | null | undefined>;
  /** When true, missing/invalid keys don't produce a 401 */
  optional?: boolean;
}
```

---

### `requireRole(role)`

Returns 403 if `c.var.user.role` doesn't match. Must be used after an auth strategy middleware.

```typescript
import { jwtAuth, requireRole } from '@web-loom/api-middleware-auth';

app.delete('/:id', jwtAuth({ secret }), requireRole('admin'), async (c) => {
  // Only admins reach here
});
```

---

### `requirePermission(permission)`

Returns 403 if `c.var.user.permissions` doesn't include the specified permission.

```typescript
import { jwtAuth, requirePermission } from "@web-loom/api-middleware-auth";

app.delete("/:id",
  jwtAuth({ secret }),
  requirePermission("posts:delete"),
  async (c) => { ... },
);
```

---

### `composeAuth(...strategies)`

Tries each strategy in order. Succeeds on the first strategy that sets `c.var.user`. Returns 401 only if all strategies fail.

```typescript
import { jwtAuth, apiKeyAuth, composeAuth } from '@web-loom/api-middleware-auth';

// Accept either JWT or API key
app.use(
  '/api/*',
  composeAuth(jwtAuth({ secret: process.env.JWT_SECRET! }), apiKeyAuth({ validate: lookupApiKey }))
);
```

---

### `csrfProtection(options?)`

CSRF protection for session-based flows. Rejects unsafe methods (POST, PUT, PATCH, DELETE) that lack a valid CSRF token.

```typescript
import { csrfProtection } from '@web-loom/api-middleware-auth';

app.use('/*', csrfProtection());
```

**Options:**

```typescript
interface CsrfProtectionOptions {
  /** Header name to check (default: "X-CSRF-Token") */
  headerName?: string;
  /** Paths to exclude from CSRF checks */
  exclude?: string[];
}
```

---

### Auth in CRUD Routes

Set `auth` on CRUD operation options to protect generated routes:

```typescript
export const Post = defineModel(postsTable, {
  name: 'Post',
  crud: {
    list: { auth: false }, // public
    read: { auth: false }, // public
    create: { auth: true }, // any authenticated user
    update: { auth: true },
    delete: { auth: 'admin' }, // only users with role "admin"
  },
});
```

---

## Writing Custom Hono Middleware

Web Loom routes are standard Hono handlers. Use Hono's `MiddlewareHandler` type:

```typescript
import type { MiddlewareHandler } from 'hono';

export const requestTimer: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  c.res.headers.set('X-Response-Time', `${Date.now() - start}ms`);
};
```

Short-circuit without calling `next()` to stop the chain:

```typescript
export const maintenanceMode: MiddlewareHandler = async (c, next) => {
  if (process.env.MAINTENANCE === 'true') {
    return c.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Down for maintenance' } }, 503);
  }
  await next();
};
```

Apply to a route:

```typescript
app.get('/', requestTimer, maintenanceMode, async (c) => {
  return c.json({ status: 'ok' });
});
```
