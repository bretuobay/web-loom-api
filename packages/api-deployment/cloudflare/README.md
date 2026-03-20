# @web-loom/api-deployment-cloudflare

Cloudflare Workers deployment adapter for [Web Loom API](https://github.com/bretuobay/web-loom-api). Includes KV namespace, D1 database, Durable Objects WebSocket support, and Workers AI integration.

## Installation

```bash
npm install @web-loom/api-deployment-cloudflare @web-loom/api-core
```

## Usage

### Basic Worker

```typescript
// src/index.ts
import { createCloudflareHandler } from '@web-loom/api-deployment-cloudflare';
import { createApp } from '@web-loom/api-core';
import config from '../webloom.config';

interface Env {
  DATABASE_URL: string;
}

// Module-level init — reused across warm invocations
let _handler: ReturnType<typeof createCloudflareHandler> | null = null;
const appPromise = (async () => {
  process.env.DATABASE_URL = ''; // set in fetch() below
  return createApp(config);
})();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Inject env before first request
    process.env.DATABASE_URL = env.DATABASE_URL;

    if (!_handler) {
      const app = await appPromise;
      _handler = createCloudflareHandler(app);
    }

    return _handler(request, env, ctx);
  },
};
```

### With Cron Trigger

```typescript
export default {
  async fetch(request, env, ctx) {
    /* ... */
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    process.env.DATABASE_URL = env.DATABASE_URL;
    const app = await appPromise;
    // Run scheduled maintenance with direct DB access
    await app.db.delete(expiredTable).where(lt(expiredTable.expiresAt, new Date()));
  },
};
```

## `createCloudflareHandler(app, options?)`

| Parameter | Type                       | Description                   |
| --------- | -------------------------- | ----------------------------- |
| `app`     | `Application`              | Web Loom application instance |
| `options` | `CloudflareHandlerOptions` | Optional platform config      |

**Returns:** `(request: Request, env: CloudflareEnv, ctx: ExecutionContext) => Promise<Response>`

## Additional Exports

### `CloudflareKVStore`

Adapts a KV namespace as a `CacheStore` for `@web-loom/api-middleware-cache`:

```typescript
import { CloudflareKVStore } from '@web-loom/api-deployment-cloudflare';
import { cache } from '@web-loom/api-middleware-cache';

routes.get('/posts', cache({ ttl: 60, store: new CloudflareKVStore(env.CACHE) }), handler);
```

### `CloudflareD1Adapter`

Connect to a D1 database instead of a remote Postgres instance:

```typescript
import { CloudflareD1Adapter } from '@web-loom/api-deployment-cloudflare';

// In your worker fetch handler:
const db = new CloudflareD1Adapter(env.DB);
```

### `WorkersAIHelper`

```typescript
import { WorkersAIHelper } from '@web-loom/api-deployment-cloudflare';

const ai = new WorkersAIHelper(env.AI);
const result = await ai.generateText('@cf/meta/llama-2-7b-chat-int8', {
  prompt: 'Summarize this article...',
});
```

### `WebSocketDurableObject`

Base class for building real-time WebSocket applications with Durable Objects:

```typescript
import { WebSocketDurableObject } from '@web-loom/api-deployment-cloudflare';

export class ChatRoom extends WebSocketDurableObject {
  async onMessage(ws: WebSocket, message: string) {
    this.broadcast(message);
  }
}
```

## `wrangler.toml` Template

```toml
name = "my-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
DATABASE_URL = "postgresql://..."

[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"

[[d1_databases]]
binding = "DB"
database_name = "my-db"
database_id = "your-d1-id"
```

## Cold Start Tips

- Use `driver: 'neon-serverless'` or `driver: 'libsql'` — both use HTTP, which works on Workers
- Cache the `_handler` reference at module scope to avoid reconstructing it every request
- Keep your bundle small: Workers have a 1 MB (free) / 10 MB (paid) script size limit

## License

MIT
