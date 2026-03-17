# Configuration Reference

Web Loom API is configured through a TypeScript file using `defineConfig()`. This gives you full type safety and IDE autocomplete.

## Basic Configuration

```typescript
// src/config.ts (or webloom.config.ts)
import { defineConfig } from "@web-loom/api-core";
import { honoAdapter } from "@web-loom/api-adapter-hono";
import { drizzleAdapter } from "@web-loom/api-adapter-drizzle";
import { zodAdapter } from "@web-loom/api-adapter-zod";

export default defineConfig({
  adapters: {
    api: honoAdapter(),
    database: drizzleAdapter(),
    validation: zodAdapter(),
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  security: {
    cors: { origin: ["*"] },
  },
  features: {
    crud: true,
  },
  observability: {
    logging: { level: "info", format: "json" },
  },
});
```

## Full Configuration Schema

### `adapters` (required)

```typescript
adapters: {
  api: honoAdapter(),              // required — HTTP framework
  database: drizzleAdapter(),      // required — database ORM
  validation: zodAdapter(),        // required — request validation
  auth?: luciaAdapter({ ... }),    // optional — authentication
  email?: resendAdapter({ ... }),  // optional — email sending
}
```

### `database` (required)

```typescript
database: {
  url: string;                     // Connection string (e.g., postgresql://...)
  poolSize?: number;               // Max connections (default: 10, use 1 for serverless)
  connectionTimeout?: number;      // Timeout in ms (default: 10000)
  readReplicas?: string[];         // Read replica connection strings
  ssl?: boolean;                   // Enable SSL (default: true in production)
}
```

### `security`

```typescript
security: {
  cors: {
    origin: string[];              // Allowed origins (e.g., ["https://app.example.com"])
    credentials?: boolean;         // Allow credentials (default: false)
    methods?: string[];            // Allowed methods (default: all)
    headers?: string[];            // Allowed headers
  },

  rateLimit?: {
    windowMs: number;              // Time window in ms (e.g., 60_000 for 1 minute)
    max: number;                   // Max requests per window (e.g., 100)
    keyGenerator?: (req: Request) => string;  // Custom key (default: IP)
  },

  requestSizeLimit?: number;       // Max body size in bytes (default: 1MB)

  securityHeaders?: {
    contentSecurityPolicy?: string;
    strictTransportSecurity?: string;
    // Custom headers added to all responses
  },
}
```

### `features`

```typescript
features: {
  crud?: boolean;                  // Auto-generate CRUD routes (default: false)
  graphql?: boolean;               // Enable GraphQL endpoint (default: false)
  websocket?: boolean;             // Enable WebSocket support (default: false)
  caching?: boolean;               // Enable response caching (default: false)
  auditLogging?: boolean;          // Enable audit logging (default: false)
}
```

### `observability`

```typescript
observability: {
  logging: {
    level: "debug" | "info" | "warn" | "error";
    format: "json" | "pretty";    // "json" for production, "pretty" for dev
  },

  metrics?: {
    enabled: boolean;
    endpoint?: string;             // Default: "/metrics"
  },

  tracing?: {
    enabled: boolean;
    sampleRate?: number;           // 0.0 to 1.0 (default: 0.1)
    exporter?: "jaeger" | "zipkin" | "otlp";
  },
}
```

### `development` (optional)

```typescript
development?: {
  hotReload?: boolean;             // Watch files and reload (default: true)
  apiDocs?: boolean;               // Serve docs at /docs (default: true)
  detailedErrors?: boolean;        // Include stack traces (default: true)
}
```

## Environment Variables

Web Loom loads `.env` files automatically in development:

```bash
# .env
DATABASE_URL=postgresql://localhost:5432/myapp
RESEND_API_KEY=re_xxxxx
FRONTEND_URL=http://localhost:3000
WEBHOOK_SECRET=whsec_xxxxx
```

### Environment-Specific Files

| File | Loaded When |
|------|-------------|
| `.env` | Always |
| `.env.local` | Always (gitignored) |
| `.env.development` | `NODE_ENV=development` |
| `.env.production` | `NODE_ENV=production` |
| `.env.test` | `NODE_ENV=test` |

Priority: `.env.local` > `.env.[environment]` > `.env`

### Required Variables

If a required environment variable is missing, the Core Runtime terminates with a descriptive error at startup. Use the CLI to generate a `.env.example`:

```bash
npx webloom generate env
```

### Accessing Variables

Environment variables are validated and typed through the config:

```typescript
// Direct access (validated at startup)
const dbUrl = process.env.DATABASE_URL!;

// Through config (type-safe)
const config = defineConfig({
  database: { url: process.env.DATABASE_URL! },
});
```

## Configuration Validation

The configuration is validated against a Zod schema at startup. Invalid configs produce specific error messages:

```
Error: Configuration validation failed:
  - adapters.api: Required
  - database.url: Expected string, received undefined
  - security.cors.origin: Expected array, received string
```

### Validating Without Starting

```bash
npx webloom test config
```

### Formatting

```bash
npx webloom format config
```

The formatter applies consistent indentation and sorts properties alphabetically within sections, preserving comments.

## Adapter-Specific Configuration

### Hono Adapter

```typescript
honoAdapter({
  basePath?: string;       // URL prefix (e.g., "/api/v1")
  strict?: boolean;        // Strict routing (trailing slashes matter)
})
```

### Drizzle Adapter

```typescript
drizzleAdapter({
  driver?: "neon" | "postgres" | "mysql";
  schema?: string;         // Database schema name
  logger?: boolean;        // Log SQL queries
})
```

### Lucia Adapter

```typescript
luciaAdapter({
  sessionExpiry?: string;  // e.g., "30d", "7d", "24h"
  cookieName?: string;     // Session cookie name
  secureCookies?: boolean; // HTTPS-only cookies (default: true in production)
})
```

### Resend Adapter

```typescript
resendAdapter({
  apiKey: string;          // Resend API key
  from: string;            // Default sender address
})
```

## Example: Production Configuration

```typescript
import { defineConfig } from "@web-loom/api-core";
import { honoAdapter } from "@web-loom/api-adapter-hono";
import { drizzleAdapter } from "@web-loom/api-adapter-drizzle";
import { zodAdapter } from "@web-loom/api-adapter-zod";
import { luciaAdapter } from "@web-loom/api-adapter-lucia";
import { resendAdapter } from "@web-loom/api-adapter-resend";

export default defineConfig({
  adapters: {
    api: honoAdapter(),
    database: drizzleAdapter(),
    validation: zodAdapter(),
    auth: luciaAdapter({ sessionExpiry: "30d" }),
    email: resendAdapter({
      apiKey: process.env.RESEND_API_KEY!,
      from: "noreply@example.com",
    }),
  },

  database: {
    url: process.env.DATABASE_URL!,
    poolSize: 10,
    readReplicas: [process.env.DATABASE_READ_URL!],
  },

  security: {
    cors: {
      origin: [process.env.FRONTEND_URL!],
      credentials: true,
    },
    rateLimit: { windowMs: 60_000, max: 100 },
    requestSizeLimit: 10 * 1024 * 1024,
  },

  features: {
    crud: true,
    caching: true,
    auditLogging: true,
  },

  observability: {
    logging: { level: "info", format: "json" },
    metrics: { enabled: true },
    tracing: { enabled: true, sampleRate: 0.1 },
  },
});
```

See the [full-stack example](../../examples/full-stack/src/config.ts) for a complete production configuration.
