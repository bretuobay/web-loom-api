# Requirements: Auth Middleware

## Introduction

This spec defines authentication and authorisation as composable Hono middleware factories rather than a class-based `AuthAdapter`. Each auth strategy (JWT, session, API key) is a separate middleware factory that integrates with Hono's context system. The framework ships middleware factories in `@web-loom/api-middleware-auth`; consumers compose them directly in route definitions or globally.

## Glossary

- **Auth_Middleware**: A Hono `MiddlewareHandler` that authenticates the incoming request and populates `c.var.user`
- **jwtAuth()**: Factory producing middleware that validates a JWT from the `Authorization: Bearer` header
- **sessionAuth()**: Factory producing middleware that validates a session cookie via a Lucia instance
- **apiKeyAuth()**: Factory producing middleware that validates an API key header
- **requireRole()**: Middleware that checks `c.var.user.role` against a required role, must run after an `Auth_Middleware`
- **requirePermission()**: Middleware that checks `c.var.user.permissions` against a required permission string
- **AuthUser**: The typed user object set on `c.var.user` after successful authentication
- **WebLoomVariables**: Extended to include `user?: AuthUser`

---

## Requirements

### 1. Shared Types

**REQ-AM-001**
The `@web-loom/api-middleware-auth` package shall export an `AuthUser` interface:

```typescript
interface AuthUser {
  id: string;
  email?: string;
  role?: string;
  permissions?: string[];
  [key: string]: unknown; // extensible for app-specific fields
}
```

**REQ-AM-002**
The `WebLoomVariables` interface in `@web-loom/api-core` shall include `user?: AuthUser` so that `c.var.user` is typed across all middleware and route handlers without casting.

---

### 2. JWT Middleware

**REQ-AM-010**
The `@web-loom/api-middleware-auth` package shall export a `jwtAuth(options: JwtAuthOptions)` factory that returns a Hono `MiddlewareHandler`.

**REQ-AM-011**
The `JwtAuthOptions` interface shall contain:

- `secret: string | CryptoKey` — the JWT signing secret or key
- `algorithm?: string` — signing algorithm (default: `'HS256'`)
- `issuer?: string` — expected `iss` claim for validation
- `audience?: string | string[]` — expected `aud` claim for validation
- `getUser?: (payload: JWTPayload) => AuthUser | Promise<AuthUser>` — custom payload-to-user mapping (default: maps `sub` → `id`, `email`, `role` directly from payload)

**REQ-AM-012**
When the `Authorization: Bearer <token>` header is present and the JWT is valid, the `jwtAuth` middleware shall set `c.var.user` to the `AuthUser` derived from the JWT payload and call `next()`.

**REQ-AM-013**
If the `Authorization` header is missing or the token is invalid or expired, the `jwtAuth` middleware shall return HTTP 401 with:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Invalid or missing token" } }
```

**REQ-AM-014**
The `jwtAuth` middleware shall use Hono's built-in JWT helpers (`hono/jwt`) rather than an external JWT library to minimise bundle size on edge runtimes.

**REQ-AM-015**
The `jwtAuth` factory shall accept an `optional: boolean` option (default: `false`). When `optional: true`, missing or invalid tokens shall set `c.var.user = undefined` and call `next()` rather than returning 401.

---

### 3. Session Middleware

**REQ-AM-020**
The `@web-loom/api-middleware-auth` package shall export a `sessionAuth(options: SessionAuthOptions)` factory that returns a Hono `MiddlewareHandler`.

**REQ-AM-021**
The `SessionAuthOptions` interface shall contain:

- `lucia: Lucia` — a configured Lucia instance (from the `lucia` package)
- `cookieName?: string` — session cookie name (default: `'session'`)
- `getUser?: (luciaUser: User) => AuthUser` — maps Lucia's user type to `AuthUser` (default: identity mapping for `id`, `email`, `role`)

**REQ-AM-022**
When a valid session cookie is present, the `sessionAuth` middleware shall call `lucia.validateSession(sessionId)`, set `c.var.user` from the validated session's user, and call `next()`.

**REQ-AM-023**
If the session cookie is missing or `lucia.validateSession()` returns an invalid result, the `sessionAuth` middleware shall return HTTP 401.

**REQ-AM-024**
When a session is validated, the `sessionAuth` middleware shall call `lucia.createSessionCookie()` and set the refreshed session cookie on the response to extend the session lifetime.

---

### 4. API Key Middleware

**REQ-AM-030**
The `@web-loom/api-middleware-auth` package shall export an `apiKeyAuth(options: ApiKeyAuthOptions)` factory that returns a Hono `MiddlewareHandler`.

**REQ-AM-031**
The `ApiKeyAuthOptions` interface shall contain:

- `validate: (key: string) => AuthUser | null | Promise<AuthUser | null>` — consumer-supplied validation function
- `header?: string` — header name to read the key from (default: `'X-API-Key'`; also accepts `Authorization: Bearer <key>`)

**REQ-AM-032**
When a valid API key is provided, the `apiKeyAuth` middleware shall call `options.validate(key)`, set `c.var.user` to the returned `AuthUser`, and call `next()`.

**REQ-AM-033**
If the API key header is missing or `options.validate()` returns `null`, the `apiKeyAuth` middleware shall return HTTP 401.

---

### 5. Role and Permission Checks

**REQ-AM-040**
The `@web-loom/api-middleware-auth` package shall export a `requireRole(role: string)` middleware factory.

**REQ-AM-041**
When `requireRole(role)` middleware runs and `c.var.user` is undefined, it shall return HTTP 401.

**REQ-AM-042**
When `requireRole(role)` middleware runs and `c.var.user.role` does not equal the required role, it shall return HTTP 403 with:

```json
{ "error": { "code": "FORBIDDEN", "message": "Insufficient role" } }
```

**REQ-AM-043**
The `@web-loom/api-middleware-auth` package shall export a `requirePermission(permission: string)` middleware factory that checks `c.var.user.permissions` includes the required permission string, returning HTTP 403 if not.

---

### 6. CSRF Protection

**REQ-AM-050**
The `@web-loom/api-middleware-auth` package shall export a `csrfProtection()` middleware factory.

**REQ-AM-051**
While session-based auth is in use, the `csrfProtection` middleware shall validate the `X-CSRF-Token` header on all state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).

**REQ-AM-052**
If the CSRF token is missing or does not match the token stored in the session, the middleware shall return HTTP 403 with `{ "error": { "code": "FORBIDDEN", "message": "CSRF token invalid" } }`.

---

### 7. Composability

**REQ-AM-060**
All auth middleware factories shall return standard Hono `MiddlewareHandler` values, composable with Hono's native `app.use()`, inline `middleware: [...]` arrays, and Hono's `createMiddleware()` utility.

**REQ-AM-061**
The `@web-loom/api-middleware-auth` package shall export a `composeAuth(...middlewares: MiddlewareHandler[])` helper that returns a single `MiddlewareHandler` executing the provided middlewares in sequence and stopping at the first success (for multi-strategy auth — e.g., accept JWT or API key).
