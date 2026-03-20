# @web-loom/api-plugins

Plugin system for [Web Loom API](https://github.com/bretuobay/web-loom-api). Register, discover, and lifecycle-manage plugins that extend the framework with middleware, routes, models, and configuration.

## Installation

```bash
npm install @web-loom/api-plugins
```

## Usage

### Creating a Plugin

```typescript
import type { Plugin, PluginContext } from '@web-loom/api-plugins';

export const analyticsPlugin: Plugin = {
  name: '@my-org/analytics-plugin',
  version: '1.0.0',

  // Plugins this one requires to be loaded first
  dependencies: [],

  async install(ctx: PluginContext) {
    // Register middleware
    ctx.addMiddleware(async (c, next) => {
      const start = Date.now();
      await next();
      trackRequest(c.req.path, Date.now() - start, c.res.status);
    });

    // Register additional routes
    ctx.addRoute('GET', '/analytics/summary', async (c) => {
      return c.json(await getSummary());
    });

    // Extend configuration
    ctx.extendConfig({ analyticsEnabled: true });
  },

  async uninstall(ctx: PluginContext) {
    // Cleanup on unload
  },
};
```

### Registering Plugins

```typescript
import { PluginManager } from '@web-loom/api-plugins';
import { createApp } from '@web-loom/api-core';

const manager = new PluginManager();

// Register plugins before creating the app
manager.register(analyticsPlugin);
manager.register(rateLimitPlugin);

const app = await createApp(config, { plugins: manager });
```

### Auto-Discovery

```typescript
import { discoverPlugins } from '@web-loom/api-plugins';

// Discover and load all @web-loom/* and webloom-plugin-* packages
const plugins = await discoverPlugins({
  patterns: ['webloom-plugin-*', '@web-loom/plugin-*'],
  cwd: process.cwd(),
});

plugins.forEach((p) => manager.register(p));
```

## `PluginContext` API

| Method                                | Description                                         |
| ------------------------------------- | --------------------------------------------------- |
| `ctx.addMiddleware(fn)`               | Register a Hono middleware applied globally         |
| `ctx.addRoute(method, path, handler)` | Register a new route                                |
| `ctx.extendConfig(partial)`           | Merge additional config into the running app config |
| `ctx.getService(name)`                | Retrieve a registered service (db, logger, etc.)    |
| `ctx.logger`                          | Access the application logger                       |

## `PluginManager` API

```typescript
const manager = new PluginManager();

manager.register(plugin); // Register a plugin
manager.unregister(name); // Remove a plugin
manager.get(name); // Get a registered plugin
manager.list(); // List all registered plugins
manager.installAll(ctx); // Call install() on all plugins (ordered by deps)
manager.uninstallAll(ctx); // Call uninstall() on all plugins (reverse order)
```

## Plugin Interface

```typescript
interface Plugin {
  /** Unique plugin name (use npm package name convention) */
  name: string;
  /** Semver version string */
  version: string;
  /** Plugin names this plugin depends on */
  dependencies?: string[];
  /** Called when the framework bootstraps */
  install(ctx: PluginContext): Promise<void>;
  /** Called on graceful shutdown */
  uninstall?(ctx: PluginContext): Promise<void>;
}
```

## License

MIT
