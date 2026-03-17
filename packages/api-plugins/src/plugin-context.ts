/**
 * Plugin Context Implementation
 *
 * Provides the extension-point API that plugins use during registration
 * to add middleware, routes, models, and extend configuration.
 */

import type {
  MiddlewareHandler,
  PluginContext,
  PluginModel,
  PluginRoute,
} from './types';

export class PluginContextImpl implements PluginContext {
  private readonly _middleware: MiddlewareHandler[] = [];
  private readonly _routes: PluginRoute[] = [];
  private readonly _models: PluginModel[] = [];
  private readonly _configExtensions: Record<string, unknown>[] = [];
  private _config: Record<string, unknown>;

  constructor(config: Record<string, unknown> = {}) {
    this._config = { ...config };
  }

  // -- PluginContext interface ------------------------------------------

  addMiddleware(handler: MiddlewareHandler): void {
    if (typeof handler !== 'function') {
      throw new Error('Middleware handler must be a function');
    }
    this._middleware.push(handler);
  }

  addRoute(route: PluginRoute): void {
    if (!route.path || !route.method || typeof route.handler !== 'function') {
      throw new Error('Route must have path, method, and handler');
    }
    this._routes.push(route);
  }

  addModel(model: PluginModel): void {
    if (!model.name || !model.fields) {
      throw new Error('Model must have name and fields');
    }
    this._models.push(model);
  }

  extendConfig(schema: Record<string, unknown>): void {
    this._configExtensions.push(schema);
    this._config = { ...this._config, ...schema };
  }

  getConfig(): Record<string, unknown> {
    return { ...this._config };
  }

  // -- Accessors for PluginManager -------------------------------------

  get middleware(): readonly MiddlewareHandler[] {
    return this._middleware;
  }

  get routes(): readonly PluginRoute[] {
    return this._routes;
  }

  get models(): readonly PluginModel[] {
    return this._models;
  }

  get configExtensions(): readonly Record<string, unknown>[] {
    return this._configExtensions;
  }
}
