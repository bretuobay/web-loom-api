# @web-loom/api-middleware-cors

CORS middleware for [Web Loom API](https://github.com/bretuobay/web-loom-api). Handles `OPTIONS` preflight requests and sets the appropriate `Access-Control-*` headers.

> **Note:** When using `@web-loom/api-core`, CORS is configured via `defineConfig({ security: { cors: { ... } } })` and applied automatically. Install this package only if you need CORS outside of the standard config or in a standalone Hono app.

## Installation

```bash
npm install @web-loom/api-middleware-cors hono
```

## Usage

```typescript
import { cors } from '@web-loom/api-middleware-cors';
import { Hono } from 'hono';

const app = new Hono();

app.use(
  '/*',
  cors({
    origins: ['https://app.example.com', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-API-Key'],
    maxAge: 86400,
  })
);
```

### Dynamic Origin

```typescript
app.use(
  '/*',
  cors({
    origins: (origin) => {
      // Allow any subdomain of example.com
      return origin.endsWith('.example.com');
    },
    credentials: true,
  })
);
```

## Options

| Option           | Type                                        | Default     | Description                        |
| ---------------- | ------------------------------------------- | ----------- | ---------------------------------- |
| `origins`        | `string[] \| ((origin: string) => boolean)` | `['*']`     | Allowed origins                    |
| `credentials`    | `boolean`                                   | `false`     | Allow `credentials`                |
| `methods`        | `string[]`                                  | All methods | Allowed HTTP methods               |
| `headers`        | `string[]`                                  | `[]`        | Allowed request headers            |
| `exposedHeaders` | `string[]`                                  | `[]`        | Headers exposed to the browser     |
| `maxAge`         | `number`                                    | `86400`     | Preflight cache duration (seconds) |

## License

MIT
