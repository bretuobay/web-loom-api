/**
 * @web-loom/api-plugins
 *
 * Plugin system for Web Loom API Framework.
 * Provides plugin registration, lifecycle management,
 * dependency resolution, and extension points for
 * middleware, routes, models, and configuration.
 */

export { PluginManager } from './plugin-manager';
export { PluginContextImpl } from './plugin-context';
export { discoverNpmPlugins, discoverLocalPlugins } from './plugin-discovery';
export type { DiscoveredPlugin } from './plugin-discovery';
export type {
  Plugin,
  PluginContext,
  PluginConfigEntry,
  PluginSystemConfig,
  PluginState,
  PluginRecord,
  PluginRoute,
  PluginModel,
  MiddlewareHandler,
} from './types';
