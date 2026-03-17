# Plugin Development

Plugins extend Web Loom API without modifying core code. They can register middleware, routes, models, and hook into lifecycle events.

## Plugin Interface

```typescript
interface Plugin {
  name: string;
  version: string;

  // Lifecycle hooks
  onInit?(runtime: CoreRuntime): Promise<void>;
  onStart?(runtime: CoreRuntime): Promise<void>;
  onShutdown?(runtime: CoreRuntime): Promise<void>;

  // Extension points
  registerMiddleware?(app: Application): void;
  registerRoutes?(app: Application): void;
  registerModels?(registry: ModelRegistry): void;
  extendConfig?(schema: ConfigSchema): void;
}
```

## Creating a Plugin

### Monitoring Plugin

```typescript
import type { Plugin } from "@web-loom/api-core";

export const monitoringPlugin: Plugin = {
  name: "monitoring",
  version: "1.0.0",

  registerMiddleware(app) {
    app.use(async (ctx, next) => {
      const start = Date.now();
      await next();
      const duration = Date.now() - start;

      metrics.recordRequest({
        method: ctx.request.method,
        path: ctx.request.url,
        status: ctx.response?.status,
        duration,
      });
    });
  },
};
```


### GraphQL Plugin

```typescript
import type { Plugin } from "@web-loom/api-core";

export const graphqlPlugin: Plugin = {
  name: "graphql",
  version: "1.0.0",

  async onInit(runtime) {
    const models = runtime.getModelRegistry().getAll();
    this.schema = generateGraphQLSchema(models);
  },

  registerRoutes(app) {
    app.post("/graphql", createGraphQLHandler(this.schema));
    app.get("/graphql", createGraphQLPlayground());
  },
};
```

### Audit Log Plugin

```typescript
export const auditPlugin: Plugin = {
  name: "audit-log",
  version: "1.0.0",

  registerMiddleware(app) {
    app.use(async (ctx, next) => {
      await next();

      if (["POST", "PUT", "PATCH", "DELETE"].includes(ctx.request.method)) {
        await ctx.db.insert(AuditLog, {
          userId: ctx.user?.id,
          action: ctx.request.method,
          resource: ctx.request.url,
          timestamp: new Date(),
          ip: ctx.request.headers.get("x-forwarded-for"),
        });
      }
    });
  },

  registerModels(registry) {
    registry.register(AuditLog);
  },
};
```

## Registering Plugins

### In Configuration

```typescript
import { defineConfig } from "@web-loom/api-core";
import { monitoringPlugin } from "./plugins/monitoring";
import { auditPlugin } from "./plugins/audit";

export default defineConfig({
  // ...
  plugins: [monitoringPlugin, auditPlugin],
});
```

### Programmatically

```typescript
const app = await createApp(config);
app.registerPlugin(monitoringPlugin);
```

## Plugin Lifecycle

Plugins are initialized in registration order:

1. `extendConfig()` — Extend the configuration schema (before config validation)
2. `onInit()` — Initialize plugin state (after adapters are ready)
3. `registerModels()` — Register additional models
4. `registerMiddleware()` — Register global middleware
5. `registerRoutes()` — Register additional routes
6. `onStart()` — Called when the app starts listening
7. `onShutdown()` — Called during graceful shutdown

## Plugin Discovery

Plugins are discovered from three sources:

1. **Configuration** — Explicitly listed in `defineConfig({ plugins: [...] })`
2. **Auto-discovery** — Packages matching `@web-loom/*` in `node_modules`
3. **Local plugins** — Files in `src/plugins/`

## Extending Configuration

Plugins can add custom configuration options:

```typescript
export const cachePlugin: Plugin = {
  name: "cache",
  version: "1.0.0",

  extendConfig(schema) {
    schema.extend({
      cache: {
        driver: { type: "string", enum: ["memory", "redis"], default: "memory" },
        ttl: { type: "number", default: 300 },
        redisUrl: { type: "string", optional: true },
      },
    });
  },

  async onInit(runtime) {
    const cacheConfig = runtime.config.cache;
    // Initialize cache based on config
  },
};
```

## Dependency Resolution

If your plugin depends on another plugin, declare it:

```typescript
export const analyticsPlugin: Plugin = {
  name: "analytics",
  version: "1.0.0",
  dependencies: ["monitoring"], // Must be loaded after monitoring

  async onInit(runtime) {
    // monitoring plugin is guaranteed to be initialized
  },
};
```

## Publishing Plugins

Package your plugin as an npm package with the `@web-loom/` prefix for auto-discovery:

```json
{
  "name": "@web-loom/plugin-monitoring",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@web-loom/api-core": "^1.0.0"
  }
}
```

## Testing Plugins

```typescript
import { createApp } from "@web-loom/api-core";
import { createTestClient } from "@web-loom/api-testing";
import { myPlugin } from "./my-plugin";

describe("My Plugin", () => {
  it("registers routes", async () => {
    const app = await createApp({
      ...baseConfig,
      plugins: [myPlugin],
    });
    const client = createTestClient(app);

    const res = await client.get("/my-plugin-route");
    expect(res.status).toBe(200);
  });
});
```
