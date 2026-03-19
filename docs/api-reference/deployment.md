# API Reference: Deployment

All deployment targets use the same `Application.handleRequest(request)` method, which delegates to the underlying Hono instance. There is no platform-specific adapter abstraction — the deployment packages are thin entry-point wrappers.

---

## Common Pattern

```typescript
// src/app.ts — shared across all platforms
import { createApp } from "@web-loom/api-core";
import config from "../webloom.config";
import "./schema"; // register models

let _app: Awaited<ReturnType<typeof createApp>> | null = null;

export async function getApp() {
  if (!_app) _app = await createApp(config);
  return _app;
}
```

---

## Node.js / Docker

```typescript
// src/index.ts
import { getApp } from "./app";

const app = await getApp();
await app.start(parseInt(process.env.PORT ?? "3000"));
```

`app.start()` uses `@hono/node-server` internally.

---

## @web-loom/api-deployment-vercel

Thin wrapper that calls `app.handleRequest()` on each Vercel Edge invocation.

```typescript
// api/index.ts (or app/api/[...route]/route.ts)
import { getApp } from "../src/app";

export const config = { runtime: "edge" };

export default async function handler(request: Request) {
  const app = await getApp();
  return app.handleRequest(request);
}
```

For Vercel Serverless Functions (Node.js runtime), the same pattern works:

```typescript
export const config = { runtime: "nodejs" };

export default async function handler(req: Request) {
  const app = await getApp();
  return app.handleRequest(req);
}
```

---

## @web-loom/api-deployment-cloudflare

Cloudflare Workers receive a `Request` and return a `Response` natively — no conversion layer needed.

```typescript
// src/worker.ts
import { createApp } from "@web-loom/api-core";
import config from "../webloom.config";
import "./schema";

interface Env {
  DATABASE_URL: string;
}

let _app: Awaited<ReturnType<typeof createApp>> | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Inject Cloudflare bindings as env vars before first init
    if (!_app) {
      process.env.DATABASE_URL = env.DATABASE_URL;
      _app = await createApp(config);
    }
    return _app.handleRequest(request);
  },
};
```

---

## @web-loom/api-deployment-aws

AWS Lambda with API Gateway HTTP API (payload format v2).

```typescript
// src/lambda.ts
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { getApp } from "./app";

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const app = await getApp();

  const url = `https://${event.requestContext.domainName}${event.rawPath}${
    event.rawQueryString ? "?" + event.rawQueryString : ""
  }`;

  const request = new Request(url, {
    method: event.requestContext.http.method,
    headers: event.headers as Record<string, string>,
    body: event.body || undefined,
  });

  const response = await app.handleRequest(request);

  const headers: Record<string, string> = {};
  response.headers.forEach((v, k) => { headers[k] = v; });

  return {
    statusCode: response.status,
    headers,
    body: await response.text(),
    isBase64Encoded: false,
  };
}
```

---

## Application Methods

```typescript
interface Application {
  /** Start an HTTP server (Node.js / Docker only) */
  start(port?: number): Promise<void>;

  /**
   * Handle a single request — use in serverless/edge environments.
   * Delegates to hono.fetch().
   */
  handleRequest(request: Request): Promise<Response>;

  /** Graceful shutdown (closes HTTP server + DB connection) */
  shutdown(timeout?: number): Promise<void>;

  /** The underlying Hono app instance */
  hono: Hono<{ Variables: WebLoomVariables }>;

  /** The active Drizzle ORM connection */
  db: AnyDrizzleDB;

  getModelRegistry(): ModelRegistry;
  getRouteRegistry(): RouteRegistry;
}
```

---

## Serverless Best Practices

**Reuse the app across invocations.** Module-level caching (as shown above) ensures the Drizzle connection and registered routes are not recreated on every request.

**Use `neon-serverless` or `libsql` drivers.** These use HTTP-based transports that don't hold persistent TCP connections, which matters on platforms that freeze execution contexts between requests.

**Set `poolSize: 1` for traditional pg driver on serverless.** Standard connection pooling doesn't mix well with serverless cold start patterns.

```typescript
// For pg driver on Lambda
database: {
  url: process.env.DATABASE_URL!,
  driver: "pg",
  poolSize: 1,
}
```
