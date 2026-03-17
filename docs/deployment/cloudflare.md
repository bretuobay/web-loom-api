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
import { honoAdapter } from "@web-loom/api-adapter-hono";
import { drizzleAdapter } from "@web-loom/api-adapter-drizzle";
import { zodAdapter } from "@web-loom/api-adapter-zod";

const config = defineConfig({
  adapters: {
    api: honoAdapter(),
    database: drizzleAdapter(),
    validation: zodAdapter(),
  },
  database: { url: process.env.DATABASE_URL!, poolSize: 1 },
  security: { cors: { origin: ["*"] } },
  features: { crud: true },
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
import { createCloudflareHandler } from "@web-loom/api-deployment-cloudflare";
import { getApp } from "./shared/app";


interface Env {
  DATABASE_URL: string;
  CACHE: KVNamespace;
}

const handler = createCloudflareHandler<Env>(async (env) => {
  process.env.DATABASE_URL = env.DATABASE_URL;
  return getApp();
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },

  // Optional: cron triggers
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    process.env.DATABASE_URL = env.DATABASE_URL;
    const app = await getApp();
    await app.db.execute(
      "DELETE FROM items WHERE created_at < NOW() - INTERVAL '30 days'"
    );
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

```typescript
const handler = createCloudflareHandler<Env>(async (env) => {
  // Use KV for response caching
  return getApp({ cache: env.CACHE });
});
```

### D1 Database

```typescript
interface Env {
  DB: D1Database;
}

const handler = createCloudflareHandler<Env>(async (env) => {
  return getApp({ database: env.DB });
});
```

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
