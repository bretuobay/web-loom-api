# Design: Auth Middleware

## Overview

Auth is three composable Hono middleware factories plus role/permission checks. No adapter class. Each factory returns a standard `MiddlewareHandler` composable with Hono's native middleware system.

```
@web-loom/api-middleware-auth exports:
  jwtAuth(options)          → MiddlewareHandler (sets c.var.user)
  sessionAuth(options)      → MiddlewareHandler (sets c.var.user)
  apiKeyAuth(options)       → MiddlewareHandler (sets c.var.user)
  requireRole(role)         → MiddlewareHandler (checks c.var.user.role)
  requirePermission(perm)   → MiddlewareHandler (checks c.var.user.permissions)
  csrfProtection(options)   → MiddlewareHandler
  composeAuth(...middlewares) → MiddlewareHandler (first-success strategy)
```

## Shared Types

```typescript
// packages/api-middleware/auth/src/types.ts

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
  permissions?: string[];
  [key: string]: unknown;
}

// Extend WebLoomVariables in api-core
declare module '@web-loom/api-core' {
  interface WebLoomVariables {
    user?: AuthUser;
  }
}
```

## jwtAuth()

```typescript
// packages/api-middleware/auth/src/jwt-auth.ts

import { verify } from 'hono/jwt';
import type { MiddlewareHandler } from 'hono';
import type { AuthUser } from './types';

export interface JwtAuthOptions {
  secret: string | CryptoKey;
  algorithm?: string;
  issuer?: string;
  audience?: string | string[];
  optional?: boolean;
  getUser?: (payload: Record<string, unknown>) => AuthUser | Promise<AuthUser>;
}

const defaultGetUser = (payload: Record<string, unknown>): AuthUser => ({
  id: String(payload.sub ?? payload.id ?? ''),
  email: payload.email as string | undefined,
  role: payload.role as string | undefined,
  permissions: payload.permissions as string[] | undefined,
});

export function jwtAuth(options: JwtAuthOptions): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/, '');

    if (!token) {
      if (options.optional) {
        await next();
        return;
      }
      return c.json(
        { error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } },
        401
      );
    }

    try {
      const payload = await verify(token, options.secret, options.algorithm ?? 'HS256');

      // Optional claim validation
      if (options.issuer && payload.iss !== options.issuer) {
        throw new Error('Invalid issuer');
      }
      if (options.audience) {
        const aud = Array.isArray(options.audience) ? options.audience : [options.audience];
        const tokenAud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
        if (!aud.some((a) => tokenAud.includes(a))) throw new Error('Invalid audience');
      }

      const getUser = options.getUser ?? defaultGetUser;
      c.set('user', await getUser(payload));
      await next();
    } catch {
      if (options.optional) {
        c.set('user', undefined);
        await next();
        return;
      }
      return c.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
        401
      );
    }
  };
}
```

## sessionAuth()

```typescript
// packages/api-middleware/auth/src/session-auth.ts

import type { Lucia } from 'lucia';

export interface SessionAuthOptions {
  lucia: Lucia;
  cookieName?: string;
  getUser?: (luciaUser: Record<string, unknown>) => AuthUser;
}

export function sessionAuth(options: SessionAuthOptions): MiddlewareHandler {
  const cookieName = options.cookieName ?? 'session';

  return async (c, next) => {
    const sessionId = getCookie(c, cookieName);
    if (!sessionId) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Session required' } }, 401);
    }

    const { session, user } = await options.lucia.validateSession(sessionId);
    if (!session) {
      deleteCookie(c, cookieName);
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session' } }, 401);
    }

    // Refresh session cookie
    const sessionCookie = options.lucia.createSessionCookie(session.id);
    setCookie(c, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

    const getUser = options.getUser ?? ((u) => ({ id: u.id as string, email: u.email as string }));
    c.set('user', getUser(user as Record<string, unknown>));
    await next();
  };
}
```

## apiKeyAuth()

```typescript
// packages/api-middleware/auth/src/api-key-auth.ts

export interface ApiKeyAuthOptions {
  validate: (key: string) => AuthUser | null | Promise<AuthUser | null>;
  header?: string;   // default: 'X-API-Key'
}

export function apiKeyAuth(options: ApiKeyAuthOptions): MiddlewareHandler {
  const headerName = options.header ?? 'X-API-Key';

  return async (c, next) => {
    let key = c.req.header(headerName);

    // Also accept Bearer token if no custom header
    if (!key && headerName === 'X-API-Key') {
      const auth = c.req.header('Authorization');
      if (auth?.startsWith('Bearer ')) key = auth.slice(7);
    }

    if (!key) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'API key required' } }, 401);
    }

    const user = await options.validate(key);
    if (!user) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } }, 401);
    }

    c.set('user', user);
    await next();
  };
}
```

## requireRole() and requirePermission()

```typescript
// packages/api-middleware/auth/src/require-role.ts

export function requireRole(role: string): MiddlewareHandler {
  return async (c, next) => {
    const user = c.var.user;
    if (!user) return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
    if (user.role !== role) return c.json({ error: { code: 'FORBIDDEN', message: `Requires role: ${role}` } }, 403);
    await next();
  };
}

export function requirePermission(permission: string): MiddlewareHandler {
  return async (c, next) => {
    const user = c.var.user;
    if (!user) return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
    if (!user.permissions?.includes(permission)) {
      return c.json({ error: { code: 'FORBIDDEN', message: `Requires permission: ${permission}` } }, 403);
    }
    await next();
  };
}
```

## composeAuth() — Multi-Strategy

```typescript
// packages/api-middleware/auth/src/compose-auth.ts

/**
 * Tries each auth middleware in order. On first success (c.var.user is set),
 * stops the chain and calls next(). If all fail, returns 401.
 */
export function composeAuth(...middlewares: MiddlewareHandler[]): MiddlewareHandler {
  return async (c, next) => {
    for (const middleware of middlewares) {
      let succeeded = false;
      let response: Response | undefined;

      await middleware(c, async () => { succeeded = true; });

      if (succeeded && c.var.user) {
        await next();
        return;
      }
    }
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  };
}
```

Usage:

```typescript
// Accept either JWT or API key
app.use('/api/*', composeAuth(
  jwtAuth({ secret: env.JWT_SECRET, optional: true }),
  apiKeyAuth({ validate: (key) => db.query.apiKeys.findFirst({ where: eq(apiKeys.key, key) }) })
));
```

## Usage Patterns

```typescript
// Global JWT auth on all /api routes
app.use('/api/*', jwtAuth({ secret: env.JWT_SECRET }));

// Single route requires admin role
app.delete('/api/users/:id',
  jwtAuth({ secret: env.JWT_SECRET }),
  requireRole('admin'),
  handler
);

// Session auth for web routes
app.use('/dashboard/*', sessionAuth({ lucia }));
```
