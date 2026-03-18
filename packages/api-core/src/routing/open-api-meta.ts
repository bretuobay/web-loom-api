import type { MiddlewareHandler } from 'hono';
import type { ZodSchema } from 'zod';

const ROUTE_META_KEY = Symbol('webloom:routeMeta');

export interface RouteMeta {
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  deprecated?: boolean;
  request?: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
    headers?: ZodSchema;
  };
  responses?: Record<number, { description: string; schema?: ZodSchema }>;
}

export interface RouteMetaEntry {
  path: string;
  method: string;
  meta: RouteMeta;
}

/**
 * Attaches OpenAPI metadata to a route for documentation generation.
 * Has no effect on request handling — purely a marker for the generator.
 */
export function openApiMeta(meta: RouteMeta): MiddlewareHandler {
  const middleware: MiddlewareHandler = async (_c, next) => {
    await next();
    return;
  };
  (middleware as any)[ROUTE_META_KEY] = meta;
  return middleware;
}

export function getRouteMeta(middleware: MiddlewareHandler): RouteMeta | undefined {
  return (middleware as any)[ROUTE_META_KEY];
}
