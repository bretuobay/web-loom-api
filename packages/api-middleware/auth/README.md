# @web-loom/api-middleware-auth

Authentication and authorization middleware for [Web Loom API](https://github.com/bretuobay/web-loom-api), built on [Hono](https://hono.dev). Supports JWT, session, and API key strategies with role/permission guards and CSRF protection.

## Installation

```bash
npm install @web-loom/api-middleware-auth hono
```

## Strategies

### JWT (`jwtAuth`)

Validates a Bearer token in the `Authorization` header. Sets `c.var.user` on success.

```typescript
import { jwtAuth } from '@web-loom/api-middleware-auth';

routes.get('/profile', jwtAuth({ secret: process.env.JWT_SECRET! }), async (c) => {
  const user = c.var.user; // AuthUser
  return c.json({ user });
});
```

**Options:**

| Option       | Type                 | Description                               |
| ------------ | -------------------- | ----------------------------------------- |
| `secret`     | `string`             | HMAC secret for HS256 verification        |
| `algorithms` | `string[]`           | Allowed algorithms (default: `['HS256']`) |
| `issuer`     | `string`             | Expected `iss` claim                      |
| `audience`   | `string \| string[]` | Expected `aud` claim                      |

---

### Session (`sessionAuth`)

Session-based authentication, compatible with [Lucia](https://lucia-auth.com). Reads the session from a cookie, validates it, and sets `c.var.user`.

```typescript
import { sessionAuth } from '@web-loom/api-middleware-auth';

routes.get('/dashboard', sessionAuth({ cookieName: 'session' }), async (c) => {
  const user = c.var.user;
  return c.json({ user });
});
```

**Options:**

| Option       | Type        | Description                                        |
| ------------ | ----------- | -------------------------------------------------- |
| `cookieName` | `string`    | Cookie name holding the session ID                 |
| `lucia`      | `LuciaLike` | Lucia instance (or any compatible session adapter) |

---

### API Key (`apiKeyAuth`)

Validates an API key from a request header or query parameter.

```typescript
import { apiKeyAuth } from '@web-loom/api-middleware-auth';

routes.get(
  '/data',
  apiKeyAuth({
    header: 'X-API-Key',
    validate: async (key) => {
      // Return AuthUser if valid, null if invalid
      return db.query.apiKeys.findFirst({ where: eq(apiKeys.key, key) });
    },
  }),
  async (c) => c.json({ data: 'ok' })
);
```

**Options:**

| Option     | Type                                         | Description                              |
| ---------- | -------------------------------------------- | ---------------------------------------- |
| `header`   | `string`                                     | Header name (e.g. `'X-API-Key'`)         |
| `query`    | `string`                                     | Query param name (alternative to header) |
| `validate` | `(key: string) => Promise<AuthUser \| null>` | Key validation callback                  |

---

### Multi-strategy (`composeAuth`)

Try multiple strategies in order; the first successful one wins.

```typescript
import { composeAuth, jwtAuth, apiKeyAuth } from '@web-loom/api-middleware-auth';

// Accept either a JWT Bearer token or an API key
const authenticate = composeAuth(
  jwtAuth({ secret: process.env.JWT_SECRET! }),
  apiKeyAuth({ header: 'X-API-Key', validate: lookupApiKey })
);

routes.get('/protected', authenticate, async (c) => {
  return c.json({ user: c.var.user });
});
```

## Authorization Guards

### `requireRole(...roles)`

Reject requests where `c.var.user.role` is not in the allowed set. Must be used after an auth strategy middleware.

```typescript
import { requireRole } from '@web-loom/api-middleware-auth';

routes.delete('/admin/users/:id', authenticate, requireRole('admin'), async (c) => {
  // Only admins reach here
});

// Multiple allowed roles
routes.get('/moderation', authenticate, requireRole('admin', 'moderator'), handler);
```

### `requirePermission(...permissions)`

Reject requests where `c.var.user.permissions` does not include all required permissions.

```typescript
import { requirePermission } from '@web-loom/api-middleware-auth';

routes.post('/posts', authenticate, requirePermission('posts:write'), handler);
```

## CSRF Protection

Validates the `X-CSRF-Token` header against the session token. Recommended for session-based auth in browser apps.

```typescript
import { csrfProtection } from '@web-loom/api-middleware-auth';

// Apply to all mutating routes
routes.use('/api/*', csrfProtection({ cookieName: 'csrf_token' }));
```

**Options:**

| Option          | Type       | Description                                             |
| --------------- | ---------- | ------------------------------------------------------- |
| `cookieName`    | `string`   | Cookie holding the CSRF token                           |
| `headerName`    | `string`   | Expected header (default: `'X-CSRF-Token'`)             |
| `ignoreMethods` | `string[]` | Methods to skip (default: `['GET', 'HEAD', 'OPTIONS']`) |

## `AuthUser` Type

All strategies set `c.var.user` to an `AuthUser` when authentication succeeds:

```typescript
interface AuthUser {
  id: string;
  email?: string;
  role?: string;
  permissions?: string[];
  [key: string]: unknown; // strategy-specific fields
}
```

## Full Example

```typescript
import { defineRoutes, validate } from '@web-loom/api-core';
import {
  composeAuth,
  jwtAuth,
  apiKeyAuth,
  requireRole,
  csrfProtection,
} from '@web-loom/api-middleware-auth';
import { z } from 'zod';

const routes = defineRoutes();

const authenticate = composeAuth(
  jwtAuth({ secret: process.env.JWT_SECRET! }),
  apiKeyAuth({ header: 'X-API-Key', validate: lookupApiKey })
);

// Public
routes.get('/posts', listPostsHandler);

// Authenticated
routes.post('/posts', authenticate, validate('json', createPostSchema), createPostHandler);

// Admin only
routes.delete('/posts/:id', authenticate, requireRole('admin'), deletePostHandler);

export default routes;
```

## License

MIT
