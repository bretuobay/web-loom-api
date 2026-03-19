/**
 * Plugin System Types
 *
 * Type definitions for plugin registration, lifecycle hooks,
 * extension points, and plugin discovery.
 */

// -----------------------------------------------------------------------
// Plugin Context (extension points provided to plugins)
// -----------------------------------------------------------------------

/** Middleware handler function */
export type MiddlewareHandler = (
  req: unknown,
  res: unknown,
  next: () => Promise<void> | void
) => Promise<void> | void;

/** Route definition registered by a plugin */
export interface PluginRoute {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
  /** URL path pattern */
  path: string;
  /** Route handler function */
  handler: (...args: unknown[]) => unknown;
  /** Optional middleware for this route */
  middleware?: MiddlewareHandler[] | undefined;
}

/** Model definition registered by a plugin */
export interface PluginModel {
  /** Model name */
  name: string;
  /** Model field definitions */
  fields: Record<string, unknown>;
  /** Optional model options */
  options?: Record<string, unknown> | undefined;
}

/** Context provided to plugins during registration */
export interface PluginContext {
  /** Register global middleware */
  addMiddleware(handler: MiddlewareHandler): void;
  /** Register a route */
  addRoute(route: PluginRoute): void;
  /** Register a model definition */
  addModel(model: PluginModel): void;
  /** Extend the configuration schema with plugin-specific options */
  extendConfig(schema: Record<string, unknown>): void;
  /** Read current configuration */
  getConfig(): Record<string, unknown>;
}

// -----------------------------------------------------------------------
// Plugin Interface
// -----------------------------------------------------------------------

/** Plugin definition with lifecycle hooks */
export interface Plugin {
  /** Unique plugin name */
  name: string;
  /** Semantic version string */
  version: string;
  /** Optional list of plugin names this plugin depends on */
  dependencies?: string[] | undefined;
  /**
   * Called during the register phase.
   * Use the context to add middleware, routes, models, or extend config.
   */
  register(context: PluginContext): void | Promise<void>;
  /** Called after all plugins are registered (initialization phase) */
  onInit?(): void | Promise<void>;
  /** Called after the application is fully started */
  onReady?(): void | Promise<void>;
  /** Called during graceful shutdown */
  onShutdown?(): void | Promise<void>;
}

// -----------------------------------------------------------------------
// Plugin Configuration
// -----------------------------------------------------------------------

/** Configuration entry for a single plugin */
export interface PluginConfigEntry {
  /** Plugin module path or npm package name */
  resolve: string;
  /** Plugin-specific options passed via config */
  options?: Record<string, unknown> | undefined;
}

/** Plugin system configuration */
export interface PluginSystemConfig {
  /** List of plugins to load */
  plugins?: Array<string | PluginConfigEntry> | undefined;
  /** Directories to scan for local plugins */
  pluginDirs?: string[] | undefined;
  /** Whether to auto-discover npm plugins with "webloom-plugin" keyword */
  autoDiscover?: boolean | undefined;
}

// -----------------------------------------------------------------------
// Plugin Lifecycle State
// -----------------------------------------------------------------------

export type PluginState =
  | 'discovered'
  | 'loaded'
  | 'registered'
  | 'initialized'
  | 'ready'
  | 'shutdown'
  | 'error';

/** Internal record tracking a loaded plugin and its state */
export interface PluginRecord {
  plugin: Plugin;
  state: PluginState;
  error?: Error | undefined;
}
