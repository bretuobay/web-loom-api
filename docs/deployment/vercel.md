# Deploy to Vercel

Deploy your Web Loom API to Vercel Edge Functions for global low-latency responses.

## Prerequisites

- A [Vercel](https://vercel.com) account
- Vercel CLI: `npm install -g vercel`
- A database accessible from edge (e.g., [Neon](https://neon.tech))

## Step 1: Create the Shared App

```typescript
// src/shared/app.ts
import { createApp, defineConfig } from '@web-loom/api-core';
import './schema'; // register models

const config = defineConfig({
  database: { url: process.env.DATABASE_URL!, driver: 'neon-serverless' },
  features: { crud: true },
  openapi: { enabled: true },
  observability: { logging: { level: 'warn', format: 'json' } },
});

let appPromise: ReturnType<typeof createApp> | null = null;

export function getApp() {
  if (!appPromise) appPromise = createApp(config);
  return appPromise;
}
```

## Step 2: Create the Vercel Handler

```typescript
// api/index.ts
export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'cdg1'],
};

export default async function handler(request: Request) {
  const { getApp } = await import('../src/shared/app');
  const app = await getApp();
  return app.handleRequest(request);
}
```

## Step 3: Configure Vercel

Create `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "functions": {
    "api/**": {
      "runtime": "edge"
    }
  },
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }]
}
```

## Step 4: Set Environment Variables

```bash
vercel env add DATABASE_URL
# Paste your Neon connection string
```

Or set them in the Vercel dashboard under Project Settings → Environment Variables.

## Step 5: Deploy

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

## Optimizations

- **Edge runtime**: Uses Web Standards API natively — zero conversion overhead
- **Region selection**: Deploy close to your database for lowest latency
- **Connection reuse**: The app instance persists across warm invocations
- **Pool size**: Use `poolSize: 1` for serverless — each invocation gets one connection
- **Lazy adapters**: Auth and email adapters load on first use, not at cold start

## Environment Variables

| Variable         | Required           | Description                  |
| ---------------- | ------------------ | ---------------------------- |
| `DATABASE_URL`   | Yes                | PostgreSQL connection string |
| `RESEND_API_KEY` | If email enabled   | Resend API key               |
| `FRONTEND_URL`   | If CORS restricted | Allowed origin               |

## Troubleshooting

**Cold starts are slow**: Check your `poolSize` (should be 1), ensure non-critical adapters are optional, and verify your database is in the same region.

**Edge runtime errors**: Make sure all dependencies are edge-compatible. Avoid Node.js-only APIs like `fs` or `net`.

**Database connection timeouts**: Use a serverless-compatible database like Neon with connection pooling enabled.

See the [serverless example](../../examples/serverless) for a complete working deployment.
