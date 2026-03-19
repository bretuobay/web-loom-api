# Design: Stack Foundation

## Architecture Overview

The stack foundation removes the three indirection adapters and commits to Hono, Drizzle, and Zod as first-class dependencies. The `CoreRuntime` is simplified to a direct bootstrapper.

```
┌─────────────────────────────────────────────────────┐
│              Application (createApp result)          │
│   hono: Hono<{Variables: WebLoomVariables}>          │
│   db:   DrizzleDB (NeonDatabase | LibSQLDatabase)    │
│   email?: EmailAdapter                               │
│   start() / handleRequest() / shutdown()             │
└─────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
  Hono App (routes/middleware)    Drizzle DB (queries)
  - Global middleware injected    - Exposed directly on ctx
  - File-based routes mounted     - No wrapper QueryBuilder
  - CRUD routes mounted           - Full Drizzle API available
  - Health routes registered
```

## Package Structure (after simplification)

```
packages/
  api-core/              ← CoreRuntime, createApp, defineConfig, registries
  api-adapters/
    resend/              ← EmailAdapter only (Hono/Drizzle/Zod adapters DELETED)
  api-middleware/
    auth/                ← jwtAuth, sessionAuth, apiKeyAuth
    cors/                ← thin re-export of hono/cors with defaults
    rate-limit/          ← thin wrapper of hono's rate limiter
  api-generators/
    crud/                ← CRUD Hono routes from Drizzle tables
    openapi/             ← OpenAPI 3.1 from routes + Zod schemas
    client/              ← typed fetch client from OpenAPI
  api-deployment/
    cloudflare/
    vercel/
    aws/
  api-testing/           ← test utilities, mock email adapter
  api-cli/               ← scaffold, generate commands
```

## Core Types

```typescript
// packages/api-core/src/types.ts

import type { Hono } from 'hono';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { EmailAdapter } from './interfaces/email-adapter';

/** Union of all supported Drizzle database types */
export type AnyDrizzleDB =
  | NeonDatabase<Record<string, never>>
  | LibSQLDatabase<Record<string, never>>
  | NodePgDatabase<Record<string, never>>;

/** Typed Hono context variables injected by the framework */
export interface WebLoomVariables {
  db: AnyDrizzleDB;
  email?: EmailAdapter;
  user?: import('./auth-types').AuthUser;
}

/** The application object returned by createApp() */
export interface Application {
  /** The underlying Hono app — use this to register additional routes/middleware */
  hono: Hono<{ Variables: WebLoomVariables }>;

  /** The Drizzle database instance */
  db: AnyDrizzleDB;

  /** Start HTTP server (Node.js / Docker) */
  start(port?: number): Promise<void>;

  /** Handle a Web Standards Request (Cloudflare, Vercel, Lambda) */
  handleRequest(request: Request): Promise<Response>;

  /** Graceful shutdown */
  shutdown(timeoutMs?: number): Promise<void>;

  /** Access model and route registries */
  getModelRegistry(): ModelRegistry;
  getRouteRegistry(): RouteRegistry;
}
```

## Configuration Shape

```typescript
// packages/api-core/src/config/types.ts

export interface WebLoomConfig {
  database: {
    url: string;
    driver: 'neon-serverless' | 'libsql' | 'pg';
    poolSize?: number;            // default: 10
    connectionTimeout?: number;   // ms, default: 10000
  };
  routes?: {
    dir?: string;                 // default: './src/routes'
  };
  email?: EmailAdapter;
  openapi?: {
    enabled?: boolean;            // default: true in dev, false in prod
    ui?: 'swagger' | 'scalar' | false;
    info?: { title: string; version: string; description?: string };
    servers?: { url: string; description?: string }[];
  };
  observability?: {
    logging?: { enabled?: boolean; level?: 'debug' | 'info' | 'warn' | 'error' };
  };
  performance?: {
    compression?: boolean;        // default: true
  };
}
```

## createApp() Implementation Sketch

```typescript
// packages/api-core/src/create-app.ts

export async function createApp(config: WebLoomConfig): Promise<Application> {
  // 1. Validate config
  const validated = validateConfig(config);

  // 2. Create Drizzle DB
  const db = await createDrizzleDB(validated.database);

  // 3. Create Hono app with typed variables
  const hono = new Hono<{ Variables: WebLoomVariables }>();

  // 4. Inject framework services as context variables (global middleware)
  hono.use('*', async (c, next) => {
    c.set('db', db);
    if (config.email) c.set('email', config.email);
    await next();
  });

  // 5. Register built-in middleware
  if (config.observability?.logging?.enabled !== false) {
    hono.use('*', logger());
  }
  if (config.performance?.compression !== false) {
    hono.use('*', compress());
  }

  // 6. Register health routes
  hono.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
  hono.get('/ready', async (c) => {
    const healthy = await checkDbHealth(db);
    return c.json({ status: healthy ? 'ok' : 'unavailable' }, healthy ? 200 : 503);
  });

  // 7. Mount CRUD-generated routes (before file-based so hand-written can override)
  mountCrudRoutes(hono, modelRegistry);

  // 8. Mount file-based route files
  await mountRouteFiles(hono, validated.routes?.dir ?? './src/routes');

  // 9. Register global error handler
  hono.onError(globalErrorHandler);

  return buildApplication(hono, db, config);
}
```

## Database Initialisation

```typescript
// packages/api-core/src/db/create-drizzle-db.ts

async function createDrizzleDB(config: DatabaseConfig): Promise<AnyDrizzleDB> {
  switch (config.driver) {
    case 'neon-serverless': {
      const { Pool, neonConfig } = await import('@neondatabase/serverless');
      neonConfig.fetchConnectionCache = true;
      const pool = new Pool({ connectionString: config.url });
      return drizzle(pool);
    }
    case 'libsql': {
      const { createClient } = await import('@libsql/client');
      const client = createClient({ url: config.url });
      return drizzle(client);
    }
    case 'pg': {
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: config.url, max: config.poolSize ?? 10 });
      return drizzle(pool);
    }
  }
}
```

## Error Response Shape

All errors produced by the framework (validation, not found, conflict, internal) share this shape:

```typescript
interface ErrorResponse {
  error: {
    code: string;         // e.g. 'VALIDATION_ERROR', 'NOT_FOUND'
    message: string;
    details?: unknown;    // field-level errors for validation
    requestId: string;    // UUIDv4, also in X-Request-Id header
    timestamp: string;    // ISO 8601
    path?: string;        // request path
  };
}
```

## Deletion Checklist

Files/packages to delete as part of this spec:

- `packages/api-adapters/hono/` — entire package
- `packages/api-adapters/drizzle/` — entire package
- `packages/api-adapters/zod/` — entire package
- `packages/api-core/src/interfaces/api-framework-adapter.ts`
- `packages/api-core/src/interfaces/database-adapter.ts`
- `packages/api-core/src/interfaces/validation-adapter.ts`
- All references to `APIFrameworkAdapter`, `DatabaseAdapter`, `ValidationAdapter`, `QueryBuilder` in other files
