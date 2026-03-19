# Tasks: Auth Middleware

## Task List

- [x] 1. Define `AuthUser` type and extend `WebLoomVariables`
  - Create `packages/api-middleware/auth/src/types.ts` with `AuthUser` interface
  - Add module augmentation for `@web-loom/api-core` to extend `WebLoomVariables` with `user?: AuthUser`
  - Export `AuthUser` from the package index
  - _Requirements: REQ-AM-001, REQ-AM-002_

- [x] 2. Implement `jwtAuth()` middleware factory
  - Create `packages/api-middleware/auth/src/jwt-auth.ts`
  - Use `verify()` from `hono/jwt` (no external JWT library)
  - Extract `Authorization: Bearer <token>` header
  - Validate `iss` and `aud` claims when provided in options
  - Map JWT payload to `AuthUser` using `getUser` option or the default mapper
  - Set `c.set('user', authUser)` on success
  - Return 401 on missing header or invalid/expired token
  - Support `optional: true` — set `user = undefined` and call `next()` instead of 401
  - Export from package index
  - _Requirements: REQ-AM-010 through REQ-AM-015_

- [x] 3. Implement `sessionAuth()` middleware factory
  - Create `packages/api-middleware/auth/src/session-auth.ts`
  - Add `lucia` as a peer dependency
  - Read session cookie using Hono's `getCookie()`
  - Call `lucia.validateSession(sessionId)`
  - Set refreshed session cookie using `lucia.createSessionCookie()` and Hono's `setCookie()`
  - Map Lucia user to `AuthUser` using `getUser` option or default
  - Return 401 on missing cookie or invalid session; delete cookie on invalid session
  - Export from package index
  - _Requirements: REQ-AM-020 through REQ-AM-024_

- [x] 4. Implement `apiKeyAuth()` middleware factory
  - Create `packages/api-middleware/auth/src/api-key-auth.ts`
  - Read key from `X-API-Key` header (default) or custom header specified in options
  - Also accept `Authorization: Bearer <key>` as fallback when `header === 'X-API-Key'`
  - Call `options.validate(key)` — support async validation
  - Set `c.set('user', authUser)` on success
  - Return 401 on missing key or null return from `validate()`
  - Export from package index
  - _Requirements: REQ-AM-030 through REQ-AM-033_

- [x] 5. Implement `requireRole()` middleware factory
  - Create `packages/api-middleware/auth/src/require-role.ts`
  - Check `c.var.user` — return 401 if undefined
  - Check `c.var.user.role === role` — return 403 if mismatch
  - Export from package index
  - _Requirements: REQ-AM-040, REQ-AM-041, REQ-AM-042_

- [x] 6. Implement `requirePermission()` middleware factory
  - In same file or adjacent: check `c.var.user.permissions?.includes(permission)`
  - Return 401 if no user, 403 if permission missing
  - Export from package index
  - _Requirements: REQ-AM-043_

- [x] 7. Implement `csrfProtection()` middleware
  - Create `packages/api-middleware/auth/src/csrf-protection.ts`
  - On state-mutating methods (POST, PUT, PATCH, DELETE), read `X-CSRF-Token` header
  - Compare against CSRF token from session (consumer-supplied token getter)
  - Return 403 if token is missing or mismatched
  - Export from package index
  - _Requirements: REQ-AM-050, REQ-AM-051, REQ-AM-052_

- [x] 8. Implement `composeAuth()` multi-strategy helper
  - Create `packages/api-middleware/auth/src/compose-auth.ts`
  - Execute each middleware in order; stop and call `next()` on first one that sets `c.var.user`
  - If all middlewares fail to set `c.var.user`, return 401
  - Export from package index
  - _Requirements: REQ-AM-060, REQ-AM-061_

- [x] 9. Write unit and integration tests
  - `jwtAuth`: valid token sets user; expired token → 401; missing header → 401; `optional: true` with missing token → user is undefined, proceeds
  - `jwtAuth`: `iss` mismatch → 401; `aud` mismatch → 401
  - `sessionAuth`: valid session sets user and refreshes cookie; missing cookie → 401; invalid session → 401 and cookie deleted
  - `apiKeyAuth`: valid key → user set; missing key → 401; invalid key (validate returns null) → 401
  - `requireRole`: no user → 401; wrong role → 403; correct role → proceeds
  - `requirePermission`: no user → 401; missing permission → 403; has permission → proceeds
  - `composeAuth`: first strategy succeeds → user set; first fails, second succeeds → user set; both fail → 401
  - `csrfProtection`: GET passes without token; POST without token → 403; POST with valid token → proceeds
