# API Reference: Deployment Adapters

## @web-loom/api-deployment-vercel

### `createVercelHandler(appFactory)`

Wraps a Web Loom app for Vercel Edge Functions.

```typescript
function createVercelHandler(
  appFactory: () => Promise<Application>
): VercelHandler;
```

**Usage:**

```typescript
import { createVercelHandler } from "@web-loom/api-deployment-vercel";
import { getApp } from "../shared/app";

export const config = {
  runtime: "edge",
  regions: ["iad1", "sfo1"],
};

export default createVercelHandler(async () => {
  const app = await getApp();
  return app;
});
```

The handler converts between Vercel's edge runtime format and Web Standards `Request`/`Response` with zero overhead.

---

## @web-loom/api-deployment-cloudflare

### `createCloudflareHandler(appFactory)`

Wraps a Web Loom app for Cloudflare Workers.

```typescript
function createCloudflareHandler<Env = unknown>(
  appFactory: (env: Env) => Promise<Application>
): CloudflareHandler<Env>;

interface CloudflareHandler<Env> {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
}
```

**Usage:**

```typescript
import { createCloudflareHandler } from "@web-loom/api-deployment-cloudflare";
import { getApp } from "../shared/app";

interface Env {
  DATABASE_URL: string;
  CACHE: KVNamespace;
}

const handler = createCloudflareHandler<Env>(async (env) => {
  process.env.DATABASE_URL = env.DATABASE_URL;
  return getApp();
});

export default {
  fetch: handler.fetch,
};
```

Supports Cloudflare-specific features:

- KV Namespace bindings
- D1 Database bindings
- Durable Objects
- Scheduled events (cron triggers)

---

## @web-loom/api-deployment-aws

### `createLambdaHandler(app)`

Wraps a Web Loom app for AWS Lambda with API Gateway v2.

```typescript
function createLambdaHandler(
  app: Application | Promise<Application>
): LambdaHandler;

type LambdaHandler = (
  event: APIGatewayProxyEventV2,
  context: Context
) => Promise<APIGatewayProxyResultV2>;
```

**Usage:**

```typescript
import { createLambdaHandler } from "@web-loom/api-deployment-aws";
import { createApp } from "@web-loom/api-core";
import config from "./config";

const app = createApp(config);
export const handler = createLambdaHandler(app);
```

Handles conversion between API Gateway event format and Web Standards `Request`/`Response`.

### Manual Lambda Handler

For full control over the Lambda lifecycle:

```typescript
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from "aws-lambda";
import { getApp } from "./app";

const appPromise = getApp();

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> {
  context.callbackWaitsForEmptyEventLoop = false;

  const app = await appPromise;
  const url = `https://${event.requestContext.domainName}${event.rawPath}`;
  const request = new Request(url, {
    method: event.requestContext.http.method,
    headers: new Headers(event.headers as Record<string, string>),
    body: event.body || undefined,
  });

  const response = await app.handleRequest(request);
  const body = await response.text();
  const headers: Record<string, string> = {};
  response.headers.forEach((v, k) => { headers[k] = v; });

  return { statusCode: response.status, headers, body };
}
```

---

## Shared App Pattern

All deployment adapters work with the same application code. Define your app once and wrap it for each platform:

```typescript
// src/shared/app.ts
import { createApp, defineConfig, defineRoutes } from "@web-loom/api-core";
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
  if (!appPromise) {
    appPromise = createApp(config);
  }
  return appPromise;
}
```

Then create platform-specific entry points that import `getApp()`. See the [serverless example](../../examples/serverless) for the complete pattern.
