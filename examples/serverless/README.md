# Serverless Example — @web-loom/api

Deploy the same Web Loom API to Vercel Edge, Cloudflare Workers, or AWS Lambda with platform-specific optimizations.

## What This Example Demonstrates

- Shared app definition used across all platforms
- Vercel Edge Functions with `createVercelHandler()`
- Cloudflare Workers with KV caching via `createCloudflareHandler()`
- AWS Lambda with cold start optimization via `createLambdaHandler()`
- Module-level caching for warm invocation reuse

## Project Structure

```
src/
├── shared/
│   ├── app.ts              # Shared app definition (used by all platforms)
│   └── models/
│       └── item.ts         # Simple model
├── vercel/
│   ├── index.ts            # Vercel edge handler
│   └── api/
│       └── hello.ts        # Standalone edge API route
├── cloudflare/
│   ├── index.ts            # Cloudflare Workers handler
│   └── worker.ts           # Raw Worker entry point
└── aws/
    ├── index.ts            # Lambda handler (adapter)
    └── handler.ts          # Lambda handler (manual)
```

## Cold Start Optimization

All handlers use these techniques to minimize cold start time:

1. **Module-level initialization** — The app is created once and cached in module scope. Warm invocations skip initialization entirely.
2. **Minimal adapter set** — Only essential adapters (Hono, Drizzle, Zod) are loaded. Optional adapters like email and auth are omitted.
3. **Low pool size** — Database pool is set to 1 connection per invocation.
4. **Lazy loading** — Non-critical features are initialized on first use, not at startup.

Typical cold start times:

- Vercel Edge: ~5ms (V8 isolate)
- Cloudflare Workers: ~5ms (V8 isolate)
- AWS Lambda: ~80ms (Node.js runtime)

## Deploying to Vercel

```bash
# Install the Vercel CLI
npm i -g vercel

# Deploy
vercel deploy
```

**vercel.json:**

```json
{
  "functions": {
    "src/vercel/**": {
      "runtime": "edge"
    }
  }
}
```

**Environment variables** (set in Vercel dashboard):

```
DATABASE_URL=postgresql://...
```

## Deploying to Cloudflare Workers

```bash
# Install Wrangler
npm i -g wrangler

# Deploy
wrangler deploy
```

**wrangler.toml:**

```toml
name = "web-loom-api"
main = "src/cloudflare/index.ts"
compatibility_date = "2024-01-01"

[vars]
DATABASE_URL = "postgresql://..."

[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
```

## Deploying to AWS Lambda

```bash
# Using Serverless Framework
npm i -g serverless
serverless deploy
```

**serverless.yml:**

```yaml
service: web-loom-api
provider:
  name: aws
  runtime: nodejs20.x
  memorySize: 256
  timeout: 10
  environment:
    DATABASE_URL: ${env:DATABASE_URL}

functions:
  api:
    handler: src/aws/index.handler
    events:
      - httpApi: '*'
```

## API Endpoints

All platforms serve the same endpoints:

| Method | Path                | Description          |
| ------ | ------------------- | -------------------- |
| GET    | `/api/health`       | Health check         |
| GET    | `/api/items`        | List items (CRUD)    |
| POST   | `/api/items`        | Create item (CRUD)   |
| GET    | `/api/items/:id`    | Get item (CRUD)      |
| PUT    | `/api/items/:id`    | Update item (CRUD)   |
| DELETE | `/api/items/:id`    | Delete item (CRUD)   |
| GET    | `/api/items/search` | Search items by name |
