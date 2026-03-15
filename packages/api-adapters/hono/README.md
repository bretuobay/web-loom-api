# @web-loom/api-adapter-hono

Hono adapter for Web Loom API Framework - A lightweight, edge-optimized HTTP framework adapter.

## Overview

This package provides the default API framework adapter for Web Loom using [Hono](https://hono.dev/), a lightweight (~12KB) web framework optimized for edge runtimes.

## Features

- **Lightweight**: ~12KB minified, perfect for edge deployments
- **Fast Routing**: Uses radix tree for efficient route matching
- **Web Standards**: Native Request/Response API support
- **Edge Runtime Support**: Works on Cloudflare Workers, Vercel Edge, Deno, Bun
- **Middleware System**: Composable middleware pipeline
- **Built-in Middleware**: CORS, compression, and logging support
- **Type Safe**: Full TypeScript support

## Installation

```bash
npm install @web-loom/api-adapter-hono
```

## Usage

### Basic Setup

```typescript
import { HonoAdapter } from '@web-loom/api-adapter-hono';

const adapter = new HonoAdapter();

// Register routes
adapter.registerRoute('GET', '/hello', async (ctx) => {
  return new Response(JSON.stringify({ message: 'Hello World' }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// Start server
await adapter.listen(3000);
console.log('Server listening on port 3000');
```

### Configuration with Built-in Middleware

```typescript
import { HonoAdapter } from '@web-loom/api-adapter-hono';

const adapter = new HonoAdapter({
  // CORS middleware
  cors: {
    enabled: true,
    origin: '*', // or specific origins: ['https://example.com']
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 3600,
  },
  
  // Compression middleware
  compression: {
    enabled: true,
  },
  
  // Logging middleware
  logging: {
    enabled: true,
    fn: (message) => console.log(`[API] ${message}`), // Custom log function
  },
});

// Register routes
adapter.registerRoute('GET', '/api/data', async (ctx) => {
  return new Response(JSON.stringify({ data: 'example' }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

await adapter.listen(3000);
```

### Route Registration

The adapter supports all standard HTTP methods:

```typescript
// GET request
adapter.registerRoute('GET', '/users/:id', async (ctx) => {
  const userId = ctx.params.id;
  return new Response(JSON.stringify({ id: userId }));
});

// POST request with body
adapter.registerRoute('POST', '/users', async (ctx) => {
  const userData = ctx.body;
  return new Response(JSON.stringify({ created: userData }), {
    status: 201,
  });
});

// PUT request
adapter.registerRoute('PUT', '/users/:id', async (ctx) => {
  const userId = ctx.params.id;
  const updates = ctx.body;
  return new Response(JSON.stringify({ id: userId, ...updates }));
});

// DELETE request
adapter.registerRoute('DELETE', '/users/:id', async (ctx) => {
  const userId = ctx.params.id;
  return new Response(null, { status: 204 });
});
```

### Path Parameters

Extract dynamic segments from URLs:

```typescript
adapter.registerRoute('GET', '/users/:userId/posts/:postId', async (ctx) => {
  const { userId, postId } = ctx.params;
  return new Response(
    JSON.stringify({ userId, postId })
  );
});
```

### Query Parameters

Access URL query parameters:

```typescript
adapter.registerRoute('GET', '/search', async (ctx) => {
  const { q, page, limit } = ctx.query;
  return new Response(
    JSON.stringify({ query: q, page, limit })
  );
});

// Request: GET /search?q=test&page=1&limit=10
```

### Request Body

The adapter automatically parses request bodies based on Content-Type:

```typescript
adapter.registerRoute('POST', '/data', async (ctx) => {
  // JSON body (Content-Type: application/json)
  const jsonData = ctx.body;
  
  return new Response(JSON.stringify({ received: jsonData }));
});
```

Supported content types:
- `application/json` - Parsed as JSON
- `application/x-www-form-urlencoded` - Parsed as form data
- `multipart/form-data` - Parsed as form data

### Middleware

Register middleware for request/response processing:

```typescript
// Global middleware (applies to all routes)
adapter.registerMiddleware(async (ctx, next) => {
  console.log(`${ctx.request.method} ${ctx.request.url}`);
  const response = await next();
  console.log(`Response status: ${response.status}`);
  return response;
});

// Scoped middleware (specific path)
adapter.registerMiddleware(
  async (ctx, next) => {
    // Check authentication
    const token = ctx.request.headers.get('Authorization');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }
    return await next();
  },
  { path: '/admin/*' }
);

// Method-specific middleware
adapter.registerMiddleware(
  async (ctx, next) => {
    // Validate POST requests
    return await next();
  },
  { path: '/api/*', methods: ['POST', 'PUT'] }
);
```

### Built-in Middleware

The adapter includes three built-in middleware options that can be configured during initialization:

#### CORS Middleware

Handles Cross-Origin Resource Sharing (CORS) headers and preflight requests:

```typescript
const adapter = new HonoAdapter({
  cors: {
    enabled: true,
    origin: '*', // Allow all origins
    // or specific origins:
    // origin: 'https://example.com',
    // origin: ['https://example.com', 'https://api.example.com'],
    // or dynamic origin validation:
    // origin: (origin) => origin.endsWith('.example.com'),
    
    credentials: true, // Allow credentials (cookies, authorization headers)
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['X-Request-Id', 'X-Total-Count'],
    maxAge: 3600, // Preflight cache duration in seconds
  },
});
```

#### Compression Middleware

Compresses response bodies using gzip, deflate, or brotli:

```typescript
const adapter = new HonoAdapter({
  compression: {
    enabled: true,
  },
});
```

The compression middleware automatically:
- Detects client support via `Accept-Encoding` header
- Compresses responses when appropriate
- Adds `Content-Encoding` header to compressed responses

#### Logging Middleware

Logs all incoming requests and their responses:

```typescript
const adapter = new HonoAdapter({
  logging: {
    enabled: true,
    // Optional: custom log function
    fn: (message) => {
      console.log(`[${new Date().toISOString()}] ${message}`);
    },
  },
});
```

Default log format includes:
- HTTP method
- Request path
- Response status code
- Response time

#### Disabling Built-in Middleware

To disable any built-in middleware, set `enabled: false`:

```typescript
const adapter = new HonoAdapter({
  cors: { enabled: false },
  compression: { enabled: false },
  logging: { enabled: false },
});
```

#### Middleware Execution Order

Built-in middleware is applied in the following order:
1. **CORS** - Handles preflight requests and adds CORS headers
2. **Logging** - Logs request details
3. **Compression** - Compresses responses
4. **Custom Middleware** - Your registered middleware
5. **Route Handlers** - Your route handlers

### Request Context

The `RequestContext` object passed to handlers contains:

```typescript
interface RequestContext {
  request: Request;              // Web Standards Request object
  params: Record<string, string>; // Path parameters
  query: Record<string, string>;  // Query parameters
  body: unknown;                  // Parsed request body
  user?: unknown;                 // User (set by auth middleware)
  session?: unknown;              // Session (set by auth middleware)
  metadata: Map<string, unknown>; // Request-scoped metadata
}
```

### Server Lifecycle

```typescript
// Start server
await adapter.listen(3000);

// Gracefully close server
await adapter.close();
```

### Direct Request Handling

For serverless environments, use `handleRequest` directly:

```typescript
// Cloudflare Workers
export default {
  async fetch(request: Request): Promise<Response> {
    return await adapter.handleRequest(request);
  },
};

// Vercel Edge Functions
export default async function handler(request: Request) {
  return await adapter.handleRequest(request);
}
```

## Integration with Web Loom

This adapter is the default API framework adapter for Web Loom. Configure it in `webloom.config.ts`:

```typescript
import { defineConfig } from '@web-loom/api-core';
import { HonoAdapter } from '@web-loom/api-adapter-hono';

export default defineConfig({
  adapters: {
    api: {
      adapter: HonoAdapter,
      config: {
        cors: {
          enabled: true,
          origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
          credentials: true,
        },
        compression: {
          enabled: true,
        },
        logging: {
          enabled: process.env.NODE_ENV !== 'production',
        },
      },
    },
    // ... other adapters
  },
});
```

## API Reference

### `HonoAdapter`

#### Constructor

##### `new HonoAdapter(options?)`

Create a new Hono adapter instance with optional configuration.

- **options**: `HonoAdapterOptions` (optional)
  - `cors`: `CORSOptions` - CORS middleware configuration
    - `enabled`: `boolean` - Enable/disable CORS middleware
    - `origin`: `string | string[] | ((origin: string) => boolean)` - Allowed origins
    - `credentials`: `boolean` - Allow credentials
    - `allowMethods`: `string[]` - Allowed HTTP methods
    - `allowHeaders`: `string[]` - Allowed request headers
    - `exposeHeaders`: `string[]` - Exposed response headers
    - `maxAge`: `number` - Preflight cache duration in seconds
  - `compression`: `CompressionOptions` - Compression middleware configuration
    - `enabled`: `boolean` - Enable/disable compression middleware
  - `logging`: `LoggingOptions` - Logging middleware configuration
    - `enabled`: `boolean` - Enable/disable logging middleware
    - `fn`: `(message: string, ...rest: string[]) => void` - Custom log function

#### Methods

##### `registerRoute(method, path, handler)`

Register a route handler for a specific HTTP method and path.

- **method**: `HTTPMethod` - HTTP method (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD)
- **path**: `string` - URL path pattern (supports `:param` for dynamic segments)
- **handler**: `RouteHandler` - Function that processes requests

##### `registerMiddleware(middleware, options?)`

Register middleware to be executed in the request pipeline.

- **middleware**: `Middleware` - Middleware function
- **options**: `MiddlewareOptions` (optional)
  - `path`: `string` - Path pattern to match
  - `methods`: `HTTPMethod[]` - HTTP methods to apply middleware to

##### `handleRequest(request)`

Handle an incoming HTTP request.

- **request**: `Request` - Web Standards Request object
- **Returns**: `Promise<Response>` - Web Standards Response object

##### `listen(port)`

Start the HTTP server listening on the specified port.

- **port**: `number` - Port number to listen on
- **Returns**: `Promise<void>`

##### `close()`

Gracefully close the HTTP server.

- **Returns**: `Promise<void>`

## Performance

Hono is optimized for performance:

- **Fast routing**: Radix tree-based router
- **Minimal overhead**: ~12KB minified
- **Edge-optimized**: Works on all edge runtimes
- **Zero dependencies**: Core framework has no dependencies

## Edge Runtime Support

The adapter works seamlessly on:

- **Cloudflare Workers**
- **Vercel Edge Functions**
- **Deno Deploy**
- **Bun**
- **Node.js** (via @hono/node-server)

## Requirements

- Node.js 18+ or compatible runtime
- TypeScript 5.0+

## Dependencies

- `hono` ^4.6.14 - The Hono framework
- `@hono/node-server` ^1.13.7 - Node.js server adapter
- `@web-loom/api-core` - Core interfaces and types
- `@web-loom/api-shared` - Shared types and utilities

## License

MIT

## Related Packages

- [@web-loom/api-core](../api-core) - Core runtime and interfaces
- [@web-loom/api-shared](../api-shared) - Shared types and utilities
- [@web-loom/api-middleware-*](../api-middleware) - Middleware packages

## Resources

- [Hono Documentation](https://hono.dev/)
- [Web Loom Documentation](https://webloom.dev/)
- [GitHub Repository](https://github.com/web-loom/web-loom)
