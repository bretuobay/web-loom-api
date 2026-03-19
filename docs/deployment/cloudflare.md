# Deploy to Cloudflare Workers

Deploy your Web Loom API to Cloudflare's global edge network.

## Prerequisites

- A [Cloudflare](https://cloudflare.com) account
- Wrangler CLI: `npm install -g wrangler`
- A database accessible from Workers (e.g., Neon, or Cloudflare D1)

## Step 1: Create the Shared App

```typescript
// src/shared/app.ts
import { createApp, defineConfig } from "@web-loom/api-core";
import "./schema"; // register models

const config = defineConfig({
  database: { url: process.env.DATABASE_URL!, driver: "neon-serverless" },
  features: { crud: true },
  openapi: { enabled: true },
  observability: { logging: { level: "warn", format: "json" } },
});

let appPromise: ReturnType<typeof createApp> | null = null;
export function getApp() {
  if (!appPromise) appPromise = createApp(config);
  return appPromise;
}
```

## Step 2: Create the Worker Entry Point

```typescript
// src/worker.ts
import { getApp } from "./shared/app";

interface Env {
  DATABASE_URL: string;
}

let initialized = false;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!initialized) {
      process.env.DATABASE_URL = env.DATABASE_URL;
      initialized = true;
    }
    const app = await getApp();
    return app.handleRequest(request);
  },

  // Optional: cron trigger
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    process.env.DATABASE_URL = env.DATABASE_URL;
    const app = await getApp();
    // Run scheduled maintenance via the Drizzle instance
    await app.db.execute("DELETE FROM sessions WHERE expires_at < NOW()");
  },
};
```

## Step 3: Configure Wrangler

Create `wrangler.toml`:

```toml
name = "my-api"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"

# Optional: D1 database
# [[d1_databases]]
# binding = "DB"
# database_name = "my-db"
# database_id = "your-d1-database-id"
```

## Step 4: Set Secrets

```bash
wrangler secret put DATABASE_URL
# Paste your connection string
```

## Step 5: Deploy

```bash
# Development
wrangler dev

# Production
wrangler deploy
```

## Cloudflare-Specific Features

### KV Storage for Caching

You can wrap the Drizzle instance or use KV directly in route handlers. Pass the KV binding via context or a module-level variable (inject it before the first `getApp()` call).

### Cron Triggers

Add to `wrangler.toml`:

```toml
[triggers]
crons = ["0 * * * *"]  # Every hour
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (secret) |
| `ENVIRONMENT` | No | Runtime environment |

## Optimizations

- Workers have sub-millisecond cold starts
- Use KV for caching to avoid database round-trips
- Connection reuse across warm invocations via module-scoped `appPromise`
- Keep `poolSize: 1` for Workers

## Troubleshooting

**Worker size limit**: Cloudflare Workers have a 1MB compressed limit. Use tree-shaking and avoid large dependencies.

**Subrequest limits**: Free plan allows 50 subrequests per invocation. Paid plans allow 1000.

**Database connectivity**: Ensure your database allows connections from Cloudflare IP ranges, or use Cloudflare D1.

See the [serverless example](../../examples/serverless) for a complete working deployment.
