# @web-loom/api-deployment-vercel

Vercel deployment adapter for [Web Loom API](https://github.com/bretuobay/web-loom-api). Wraps a Web Loom `Application` in a Vercel-compatible edge function handler.

## Installation

```bash
npm install @web-loom/api-deployment-vercel @web-loom/api-core
```

## Usage

```typescript
// api/index.ts  (or src/vercel/index.ts)
import { createVercelHandler } from '@web-loom/api-deployment-vercel';
import { createApp } from '@web-loom/api-core';
import config from '../webloom.config';

// Export edge runtime config for Vercel
export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'cdg1'],
};

// Pre-warm: start initialization before first request
const appPromise = createApp(config);

export default async function handler(request: Request): Promise<Response> {
  const app = await appPromise;
  return createVercelHandler(app)(request);
}
```

### With Vercel KV Cache

```typescript
import { createVercelHandler, VercelKVCacheStore } from '@web-loom/api-deployment-vercel';
import { kv } from '@vercel/kv';

export default async function handler(request: Request): Promise<Response> {
  const app = await appPromise;
  return createVercelHandler(app, {
    // Pass a Vercel KV-backed cache store to the app
    cacheStore: new VercelKVCacheStore(kv),
  })(request);
}
```

## `createVercelHandler(app, options?)`

| Parameter           | Type          | Description                   |
| ------------------- | ------------- | ----------------------------- |
| `app`               | `Application` | Web Loom application instance |
| `options.streaming` | `boolean`     | Enable streaming responses    |
| `options.envPrefix` | `string`      | Prefix for env var forwarding |

**Returns:** `(req: Request) => Promise<Response>` — a standard Vercel edge function handler.

## Utilities

### `loadVercelEnv(prefix?)`

Load `VERCEL_*` environment variables into a structured config object.

```typescript
import { loadVercelEnv } from '@web-loom/api-deployment-vercel';

const env = loadVercelEnv();
// { region: 'iad1', url: 'https://...', env: 'production', ... }
```

### `detectRuntime()`

Returns `'edge'` or `'serverless'` based on the current execution context.

```typescript
import { detectRuntime, isEdgeRuntime } from '@web-loom/api-deployment-vercel';

if (isEdgeRuntime()) {
  // Use edge-compatible APIs only
}
```

## `vercel.json` Configuration

```json
{
  "functions": {
    "api/**": { "runtime": "edge" }
  }
}
```

## Cold Start Tips

- Use `driver: 'neon-serverless'` in `defineConfig` for HTTP-based DB connections (no TCP handshake)
- Keep `poolSize: 1` — serverless functions handle one request at a time
- Pre-warm by initializing the app at module scope (`const appPromise = createApp(config)`)
- Deploy to regions close to your database (e.g. Neon's primary region)

## License

MIT
