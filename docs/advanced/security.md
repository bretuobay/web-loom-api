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

Protect against abuse and DDoS:

```typescript
security: {
  rateLimit: {
    windowMs: 60_000,  // 1 minute
    max: 100,          // 100 requests per minute per IP
  },
}
```

### Per-Route Limits

Stricter limits for sensitive endpoints:

```typescript
router.post('/api/auth/login', {
  rateLimit: { windowMs: 60_000, max: 5 },
  handler: async (ctx) => {
    /* ... */
  },
});
```

### Per-User Limits

When auth is enabled, rate limits can be scoped per user:

```typescript
rateLimit: {
  windowMs: 60_000,
  max: 100,
  keyGenerator: (ctx) => ctx.user?.id || ctx.request.headers.get("x-forwarded-for") || "anonymous",
}
```

## Authentication

### Session-Based Auth

```typescript
import { sessionAuth } from '@web-loom/api-middleware-auth';

// In your route file or global middleware
app.use(
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
router.get('/api/data', {
  middleware: [apiKeyAuth],
  handler: async (ctx) => {
    // ctx.apiKey.scopes contains ["read", "write"]
  },
});
```

### OAuth2

```typescript
// Generate authorization URL
router.get('/api/auth/github', {
  handler: async (ctx) => {
    const url = ctx.auth.getOAuthAuthorizationUrl('github', state);
    return ctx.redirect(url);
  },
});

// Handle callback
router.get('/api/auth/github/callback', {
  handler: async (ctx) => {
    const user = await ctx.auth.handleOAuthCallback('github', ctx.query.code);
    const session = await ctx.auth.createSession(user.id);
    ctx.setCookie('session', session.id, { httpOnly: true, secure: true });
    return ctx.redirect('/');
  },
});
```

## Input Sanitization

The Validation Adapter sanitizes inputs by default:

- HTML tags stripped from string inputs
- Special characters escaped
- Email addresses normalized
- URLs validated and normalized
- SQL keywords rejected in unexpected contexts

### Opt-Out for Specific Fields

```typescript
{
  name: "htmlContent",
  type: "string",
  validation: { sanitize: false },  // Allow raw HTML
}
```

## Security Headers

Applied automatically to all responses:

| Header                      | Value                                 | Purpose               |
| --------------------------- | ------------------------------------- | --------------------- |
| `X-Content-Type-Options`    | `nosniff`                             | Prevent MIME sniffing |
| `X-Frame-Options`           | `DENY`                                | Prevent clickjacking  |
| `X-XSS-Protection`          | `1; mode=block`                       | XSS filter            |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Force HTTPS           |
| `Content-Security-Policy`   | `default-src 'self'`                  | Content restrictions  |

### Custom Headers

```typescript
security: {
  securityHeaders: {
    contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'",
    strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
  },
}
```

## Request Size Limits

Prevent large payload attacks:

```typescript
security: {
  requestSizeLimit: 1 * 1024 * 1024,  // 1MB default
}
```

Per-route overrides for file uploads:

```typescript
router.post('/api/uploads', {
  rateLimit: { max: 10 },
  // File upload routes can have larger limits
  handler: async (ctx) => {
    /* ... */
  },
});
```

Requests exceeding the limit return HTTP 413.

## SQL Injection Prevention

The Database Adapter uses parameterized queries for all user input:

```typescript
// Safe — parameterized
const users = await ctx.db.select(User).where('email', '=', ctx.query.email);

// Also safe — raw queries are parameterized
await ctx.db.query('SELECT * FROM users WHERE email = $1', [ctx.query.email]);
```

Never interpolate user input into SQL strings.

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
- Data modifications (create/update/delete) with before/after values
- API key creation/revocation
- Configuration changes

Audit logs are written to a separate stream and are append-only.

## Environment Variables

Never log or expose environment variable values:

```typescript
// Web Loom automatically redacts these from logs:
// - DATABASE_URL
// - API keys
// - Passwords
// - Tokens
```

Use `.env.local` for local secrets (gitignored by default).

## Development vs Production

Web Loom automatically adjusts security based on `NODE_ENV`:

| Feature                 | Development | Production              |
| ----------------------- | ----------- | ----------------------- |
| Stack traces in errors  | Yes         | No                      |
| CORS                    | All origins | Configured origins only |
| Secure cookies          | Optional    | Required                |
| SQL query logging       | Yes         | No                      |
| API docs at /docs       | Yes         | No                      |
| Detailed error messages | Yes         | Generic messages        |

Never set `NODE_ENV=development` in production. Web Loom detects the environment automatically.

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
- [ ] Database connection uses SSL
- [ ] API keys have appropriate scopes
