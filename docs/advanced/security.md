# Security Best Practices

Web Loom API includes security features out of the box. This guide covers configuration and best practices.

## CORS

Configure allowed origins to prevent unauthorized cross-origin requests:

```typescript
security: {
  cors: {
    // Production: restrict to your frontend
    origins: ["https://app.example.com"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    headers: ["Content-Type", "Authorization"],
  },
}
```

Never use `origin: ["*"]` with `credentials: true` in production.

## Rate Limiting

Protect against abuse and DDoS. Add `@web-loom/api-middleware-rate-limit` as middleware:

```typescript
import { rateLimit } from '@web-loom/api-middleware-rate-limit';

// Global: 100 requests/minute per IP
app.hono.use('/*', rateLimit({ maxTokens: 100, window: 'minute' }));
```

### Per-Route Limits

Stricter limits for sensitive endpoints:

```typescript
import { rateLimit } from '@web-loom/api-middleware-rate-limit';
import { defineRoutes } from '@web-loom/api-core';

const routes = defineRoutes();

routes.post('/auth/login', rateLimit({ maxTokens: 5, window: 'minute' }), async (c) => {
  /* ... */
});
```

### Per-User Limits

When auth is enabled, rate limits can be scoped per authenticated user:

```typescript
rateLimit({
  maxTokens: 100,
  window: 'minute',
  keyStrategy: 'user', // falls back to IP when user is not authenticated
});
```

Or provide a custom key:

```typescript
rateLimit({
  maxTokens: 100,
  window: 'minute',
  keyStrategy: 'custom',
  keyGenerator: (req) =>
    req.headers.get('x-user-id') ?? req.headers.get('x-forwarded-for') ?? 'anonymous',
});
```

## Authentication

### JWT Auth

Bearer token validation for stateless APIs:

```typescript
import { jwtAuth } from '@web-loom/api-middleware-auth';
import { defineRoutes } from '@web-loom/api-core';

const routes = defineRoutes();

routes.use('/*', jwtAuth({ secret: process.env.JWT_SECRET! }));

routes.get('/profile', async (c) => {
  const user = c.var.user!; // AuthUser set by jwtAuth
  return c.json({ user });
});
```

### Session-Based Auth

Cookie sessions using Lucia:

```typescript
import { sessionAuth } from '@web-loom/api-middleware-auth';

app.hono.use(
  '/*',
  sessionAuth({
    lucia: luciaInstance,
    cookieName: 'session',
  })
);
```

### API Key Auth

For machine-to-machine communication:

```typescript
import { apiKeyAuth } from '@web-loom/api-middleware-auth';

const routes = defineRoutes();

routes.use(
  '/v1/*',
  apiKeyAuth({
    validate: async (key) => {
      const record = await db.select().from(apiKeysTable).where(eq(apiKeysTable.key, key)).get();
      return record ? { id: record.userId, role: record.role } : null;
    },
  })
);
```

### Composing Auth Strategies

Try multiple strategies in order — first match wins:

```typescript
import { composeAuth, jwtAuth, apiKeyAuth } from '@web-loom/api-middleware-auth';

routes.use(
  '/*',
  composeAuth(jwtAuth({ secret: process.env.JWT_SECRET! }), apiKeyAuth({ validate: lookupApiKey }))
);
```

### Role-Based Access Control

Protect routes with role or permission guards:

```typescript
import { requireRole, requirePermission } from '@web-loom/api-middleware-auth';

routes.delete('/posts/:id', jwtAuth(), requireRole('admin'), async (c) => {
  // Only admins reach here
});

routes.post('/invoices', jwtAuth(), requirePermission('billing:write'), async (c) => {
  // Only users with the billing:write permission reach here
});
```

### OAuth2 / Social Login

OAuth2 flows are handled outside the framework using standard Fetch API and Lucia:

```typescript
const routes = defineRoutes();

// Step 1: Redirect to provider
routes.get('/auth/github', async (c) => {
  const [url, state] = await createGitHubAuthorizationURL();
  setCookie(c, 'github_oauth_state', state, { httpOnly: true, secure: true, path: '/' });
  return c.redirect(url.toString());
});

// Step 2: Handle callback
routes.get('/auth/github/callback', async (c) => {
  const code = c.req.query('code') ?? '';
  const { user } = await validateGitHubCallback(code);
  const session = await lucia.createSession(user.id, {});
  setCookie(c, lucia.sessionCookieName, session.id, {
    httpOnly: true,
    secure: true,
    path: '/',
  });
  return c.redirect('/');
});
```

## Input Sanitization

The `@web-loom/api-middleware-validation` package provides HTML escaping and path traversal detection utilities:

```typescript
import { sanitize, sanitizeObject, requestSizeLimit } from '@web-loom/api-middleware-validation';

// Escape HTML in a string
sanitize('<script>alert("xss")</script>');
// => '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'

// Recursively sanitize all string values in an object
const safe = sanitizeObject(c.req.valid('json'));

// Detect path traversal attempts
import { isPathTraversal } from '@web-loom/api-middleware-validation';
if (isPathTraversal(fileName)) {
  return c.json({ error: { code: 'FORBIDDEN', message: 'Invalid path' } }, 403);
}
```

### Request Size Limits

Apply as middleware to reject oversized payloads:

```typescript
import { requestSizeLimit } from '@web-loom/api-middleware-validation';

// Global: 1MB
app.hono.use('/*', requestSizeLimit(1 * 1024 * 1024));

// Per-route: 10MB for uploads
routes.post('/uploads', requestSizeLimit(10 * 1024 * 1024), handleUpload);
```

Requests exceeding the limit return HTTP 413 with:

```json
{ "error": "Payload Too Large", "code": "PAYLOAD_TOO_LARGE", "maxBytes": 1048576 }
```

## Security Headers

Applied automatically by Hono's `secureHeaders()` middleware (configured in `security.headers`):

| Header                      | Value                                 | Purpose               |
| --------------------------- | ------------------------------------- | --------------------- |
| `X-Content-Type-Options`    | `nosniff`                             | Prevent MIME sniffing |
| `X-Frame-Options`           | `DENY`                                | Prevent clickjacking  |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Force HTTPS           |
| `Content-Security-Policy`   | `default-src 'self'`                  | Content restrictions  |

## SQL Injection Prevention

Drizzle ORM uses parameterized queries for all operations. There is no string interpolation of user input into SQL:

```typescript
import { eq } from 'drizzle-orm';
import { usersTable } from './schema';

// Safe: Drizzle parameterizes the value
const users = await c.var.db
  .select()
  .from(usersTable)
  .where(eq(usersTable.email, c.req.query('email') ?? ''));
```

Never build raw SQL strings from user input. If you need raw queries, use Drizzle's `sql` tagged template which handles parameterization:

```typescript
import { sql } from 'drizzle-orm';

// Safe: sql template parameterizes values
const result = await c.var.db.execute(sql`SELECT * FROM users WHERE email = ${userEmail}`);
```

## Audit Logging

Enable audit logging for security-relevant events:

```typescript
features: {
  auditLogging: true,
}
```

Logged events:

- Authentication attempts (success/failure)
- Authorization failures
- Data modifications (create/update/delete)
- API key usage
- Rate limit violations

Audit logs are written to a separate stream and are append-only.

## Environment Variables

Never log or expose environment variable values. Web Loom automatically redacts these from logs:

- `DATABASE_URL`
- Values containing `KEY`, `SECRET`, `PASSWORD`, `TOKEN`

Use `.env.local` for local secrets (gitignored by default).

## Development vs Production

Web Loom automatically adjusts security based on `NODE_ENV`:

| Feature                 | Development | Production              |
| ----------------------- | ----------- | ----------------------- |
| Stack traces in errors  | Yes         | No                      |
| CORS                    | All origins | Configured origins only |
| Secure cookies          | Optional    | Required                |
| SQL query logging       | Yes         | No                      |
| API docs at /docs       | Yes         | Configurable            |
| Detailed error messages | Yes         | Generic messages        |

Never set `NODE_ENV=development` in production.

## Checklist

Before deploying to production:

- [ ] CORS restricted to your frontend domain
- [ ] Rate limiting enabled
- [ ] Authentication on all sensitive routes
- [ ] Environment variables set (not hardcoded)
- [ ] `NODE_ENV=production`
- [ ] HTTPS enforced
- [ ] Request size limits configured
- [ ] Audit logging enabled
- [ ] Database connection uses SSL (`ssl: true` in `defineConfig`)
- [ ] API keys have appropriate scopes
