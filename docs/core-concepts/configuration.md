# Configuration Reference

Web Loom API is configured through a TypeScript file using `defineConfig()`. This gives you full type safety and IDE autocomplete.

## Basic Configuration

```typescript
// webloom.config.ts
import { defineConfig } from '@web-loom/api-core';

export default defineConfig({
  database: {
    url: process.env.DATABASE_URL!,
    driver: 'neon-serverless',
  },
  routes: {
    dir: './src/routes',
  },
  openapi: {
    enabled: true,
    title: 'My API',
    version: '1.0.0',
  },
});
```

`defineConfig()` validates the configuration at startup and throws a `ConfigurationError` for invalid or missing values.

## Full Configuration Schema

### `database` (required)

```typescript
database: {
  /** Connection string. Required — throws ConfigurationError if missing. */
  url: string;

  /**
   * Drizzle driver to use.
   * Install the corresponding package:
   *   neon-serverless → @neondatabase/serverless
   *   libsql          → @libsql/client
   *   pg              → pg
   */
  driver: "neon-serverless" | "libsql" | "pg";

  /** Max connections in the pool (pg driver only, default: 10) */
  poolSize?: number;

  /** Connection timeout in ms (pg driver only, default: 10000) */
  connectionTimeout?: number;

  /** Enable SSL/TLS (pg driver only, default: false) */
  ssl?: boolean;
}
```

### `routes`

```typescript
routes?: {
  /**
   * Directory to scan for route files.
   * Route files must export a Hono app as their default export.
   * @default './src/routes'
   */
  dir?: string;
}
```

### `email`

An `EmailAdapter` instance. When provided it is injected into every request as `c.var.email`. Accessing `c.var.email` without configuring an adapter throws a `ConfigurationError`.

```typescript
import { ResendAdapter } from "@web-loom/api-shared";

email?: new ResendAdapter({
  apiKey: process.env.RESEND_API_KEY!,
  from: "noreply@example.com",
})
```

### `openapi`

```typescript
openapi?: {
  /**
   * Enable /openapi.json, /openapi.yaml, and /docs routes.
   * @default true
   */
  enabled?: boolean;

  /**
   * UI library to serve at /docs.
   * @default "swagger"
   */
  ui?: "swagger" | "scalar";

  /** API title shown in the docs UI */
  title?: string;

  /** API version string, e.g. "1.0.0" */
  version?: string;

  /** Description rendered in the docs UI */
  description?: string;
}
```

### `security`

```typescript
security?: {
  cors: {
    /** Allowed origins. Use ["*"] for development only. */
    origins: string[] | RegExp[];
    credentials?: boolean;
    methods?: string[];
    headers?: string[];
    exposedHeaders?: string[];
    /** Preflight cache max-age in seconds (default: 86400) */
    maxAge?: number;
  };

  rateLimit?: {
    /** Max requests allowed in the window */
    limit: number;
    /** Time window: "30s", "1m", "1h", "1d" */
    window: string;
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
  };

  /** Max request body size in bytes (default: 1 MB) */
  requestSizeLimit?: number;

  securityHeaders?: {
    contentSecurityPolicy?: {
      directives: Record<string, string[]>;
      reportUri?: string;
    };
    hsts?: {
      maxAge: number;
      includeSubDomains?: boolean;
      preload?: boolean;
    };
    frameOptions?: "DENY" | "SAMEORIGIN" | string;
    contentTypeOptions?: "nosniff";
  };
}
```

### `features`

```typescript
features?: {
  /** Auto-generate CRUD routes for models with crud: true (default: true) */
  crud?: boolean;
  graphql?: boolean;
  websocket?: boolean;
  caching?: boolean;
  auditLogging?: boolean;
}
```

### `observability`

```typescript
observability?: {
  logging: {
    level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
    format?: "json" | "pretty" | "text";
  };

  metrics?: {
    enabled: boolean;
    endpoint?: string; // default: "/metrics"
  };

  tracing?: {
    enabled: boolean;
    exporter: "otlp" | "jaeger" | "zipkin";
    endpoint: string;
    serviceName: string;
    sampleRate?: number;
  };
}
```

### `development`

```typescript
development?: {
  hotReload?: boolean;     // default: true
  apiDocs?: boolean;       // default: true
  detailedErrors?: boolean; // include stack traces (default: true)
  playground?: boolean;
  mockData?: boolean;
}
```

## Environment Variables

Web Loom loads `.env` files automatically in development:

```bash
# .env
DATABASE_URL=postgresql://localhost:5432/myapp
RESEND_API_KEY=re_xxxxx
JWT_SECRET=supersecretvalue
```

## Production Configuration Example

```typescript
// webloom.config.ts
import { defineConfig } from '@web-loom/api-core';

export default defineConfig({
  database: {
    url: process.env.DATABASE_URL!,
    driver: 'neon-serverless',
  },

  routes: { dir: './src/routes' },

  openapi: {
    enabled: process.env.NODE_ENV !== 'production',
    title: 'My API',
    version: '2.0.0',
    ui: 'scalar',
  },

  security: {
    cors: {
      origins: [process.env.FRONTEND_URL!],
      credentials: true,
    },
    rateLimit: { window: '1m', limit: 100 },
  },

  features: { crud: true },

  observability: {
    logging: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
    },
  },
});
```

## Driver Reference

| Driver            | Use case                                   | Required package           |
| ----------------- | ------------------------------------------ | -------------------------- |
| `neon-serverless` | Neon Postgres; edge-safe HTTP transport    | `@neondatabase/serverless` |
| `libsql`          | Turso (distributed SQLite) or local SQLite | `@libsql/client`           |
| `pg`              | Standard PostgreSQL (Docker, VMs, RDS)     | `pg`                       |

For SQLite with `libsql`, use a file URL in development:

```typescript
database: {
  url: "file:./dev.db",
  driver: "libsql",
}
```
