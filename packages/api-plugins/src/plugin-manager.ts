/**
 * Plugin Manager
 *
 * Orchestrates the full plugin lifecycle:
 *   discover → load → register → init → ready → shutdown
 *
 * Handles dependency resolution, circular dependency detection,
 * and supports both local file paths and npm package plugins.
 */

import { PluginContextImpl } from './plugin-context';
import type {
  Plugin,
  PluginRecord,
  PluginState,
  PluginSystemConfig,
} from './types';

export class PluginManager {
  private readonly _plugins = new Map<string, PluginRecord>();
  private readonly _context: PluginContextImpl;
  private readonly _config: PluginSystemConfig;

  get config(): PluginSystemConfig { return this._config; }

  constructor(config: PluginSystemConfig = {}, appConfig: Record<string, unknown> = {}) {
    this._config = config;
    this._context = new PluginContextImpl(appConfig);
  }

  // -- Public API -------------------------------------------------------

  /**
   * Load a plugin instance directly (already-resolved object).
   * Validates the plugin interface before accepting it.
   */
  loadPlugin(plugin: Plugin): void {
    this._validatePlugin(plugin);

    if (this._plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already loaded`);
    }

    this._plugins.set(plugin.name, { plugin, state: 'loaded' });
  }

  /**
   * Register a plugin by module path or npm package name.
   * The module must default-export or named-export a Plugin object.
   */
  async registerPlugin(resolve: string): Promise<void> {
    const plugin = await this._resolveModule(resolve);
    this._validatePlugin(plugin);


    if (this._plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already loaded`);
    }

    this._plugins.set(plugin.name, { plugin, state: 'loaded' });
  }

  /**
   * Run the full lifecycle: resolve dependencies → register → init → ready.
   * Plugins are processed in dependency order.
   */
  async initializeAll(): Promise<void> {
    const ordered = this._resolveDependencyOrder();

    // Register phase
    for (const name of ordered) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const record = this._plugins.get(name)!;
      if (record.state !== 'loaded') continue;
      try {
        await record.plugin.register(this._context);
        record.state = 'registered';
      } catch (err) {
        record.state = 'error';
        record.error = err instanceof Error ? err : new Error(String(err));
        throw new Error(`Plugin "${name}" failed during register: ${record.error.message}`);
      }
    }

    // Init phase
    for (const name of ordered) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const record = this._plugins.get(name)!;
      if (record.state !== 'registered') continue;
      try {
        await record.plugin.onInit?.();
        record.state = 'initialized';
      } catch (err) {
        record.state = 'error';
        record.error = err instanceof Error ? err : new Error(String(err));
        throw new Error(`Plugin "${name}" failed during onInit: ${record.error.message}`);
      }
    }

    // Ready phase
    for (const name of ordered) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const record = this._plugins.get(name)!;
      if (record.state !== 'initialized') continue;
      try {
        await record.plugin.onReady?.();
        record.state = 'ready';
      } catch (err) {
        record.state = 'error';
        record.error = err instanceof Error ? err : new Error(String(err));
        throw new Error(`Plugin "${name}" failed during onReady: ${record.error.message}`);
      }
    }
  }

  /**
   * Shut down all plugins in reverse dependency order.
   */
  async shutdownAll(): Promise<void> {
    const ordered = this._resolveDependencyOrder().reverse();

    for (const name of ordered) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const record = this._plugins.get(name)!;
      if (record.state === 'error' || record.state === 'shutdown') continue;
      try {
        await record.plugin.onShutdown?.();
        record.state = 'shutdown';
      } catch (err) {
        record.state = 'error';
        record.error = err instanceof Error ? err : new Error(String(err));
        // Continue shutting down remaining plugins
      }
    }
  }

  // -- Accessors --------------------------------------------------------

  /** Get the shared plugin context (middleware, routes, models, config) */
  get context(): PluginContextImpl {
    return this._context;
  }

  /** Get the state of a specific plugin */
  getPluginState(name: string): PluginState | undefined {
    return this._plugins.get(name)?.state;
  }

  /** Get all loaded plugin names */
  getPluginNames(): string[] {
    return Array.from(this._plugins.keys());
  }

  /** Get a plugin record by name */
  getPlugin(name: string): PluginRecord | undefined {
    return this._plugins.get(name);
  }


  // -- Private helpers --------------------------------------------------

  /**
   * Validate that an object satisfies the Plugin interface.
   */
  private _validatePlugin(plugin: unknown): asserts plugin is Plugin {
    if (!plugin || typeof plugin !== 'object') {
      throw new Error('Plugin must be a non-null object');
    }
    const p = plugin as Record<string, unknown>;
    if (typeof p['name'] !== 'string' || p['name'].length === 0) {
      throw new Error('Plugin must have a non-empty "name" string');
    }
    if (typeof p['version'] !== 'string' || p['version'].length === 0) {
      throw new Error('Plugin must have a non-empty "version" string');
    }
    if (typeof p['register'] !== 'function') {
      throw new Error('Plugin must have a "register" function');
    }
  }

  /**
   * Resolve a module path to a Plugin object.
   * Supports default exports and named `plugin` exports.
   */
  private async _resolveModule(resolve: string): Promise<Plugin> {
    try {
      const mod = await import(resolve);
      const plugin = mod.default ?? mod.plugin ?? mod;
      return plugin as Plugin;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to load plugin from "${resolve}": ${msg}`);
    }
  }

  /**
   * Topological sort of plugins based on their declared dependencies.
   * Detects circular dependencies and missing dependencies.
   */
  private _resolveDependencyOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>(); // cycle detection
    const order: string[] = [];
    const allNames = Array.from(this._plugins.keys());

    const visit = (name: string, chain: string[]): void => {
      if (visited.has(name)) return;

      if (visiting.has(name)) {
        const cycle = [...chain, name].join(' → ');
        throw new Error(`Circular plugin dependency detected: ${cycle}`);
      }

      const record = this._plugins.get(name);
      if (!record) {
        throw new Error(
          `Plugin "${chain[chain.length - 1]}" depends on "${name}" which is not loaded`,
        );
      }

      visiting.add(name);

      const deps = record.plugin.dependencies ?? [];
      for (const dep of deps) {
        visit(dep, [...chain, name]);
      }

      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    for (const name of allNames) {
      visit(name, []);
    }

    return order;
  }
}
