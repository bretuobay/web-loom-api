import { Hono } from 'hono';
import { readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { WebLoomVariables } from '../types';
import { filePathToMountPath } from './path-utils';
import { RouteLoadError, RouteConflictError } from './errors';
import { getRouteMeta, type RouteMetaEntry } from './open-api-meta';
import type { RouteRegistry } from '../registry/route-registry';
import type { HTTPMethod } from '@web-loom/api-shared';

interface DiscoverRoutesOptions {
  basePath?: string;
  routeRegistry?: RouteRegistry;
  routeMetaEntries?: RouteMetaEntry[];
}

function joinPaths(...parts: string[]): string {
  const segments = parts.flatMap((part) => part.split('/').filter(Boolean));
  return segments.length ? `/${segments.join('/')}` : '/';
}

function buildRouteMetadata(meta: RouteMetaEntry['meta']) {
  const responses = meta.responses
    ? Object.entries(meta.responses).map(([status, response]) => {
        const responseEntry: {
          status: number;
          description: string;
          schema?: unknown;
        } = {
          status: Number(status),
          description: response.description,
        };

        if (response.schema !== undefined) {
          responseEntry.schema = response.schema;
        }

        return responseEntry;
      })
    : undefined;

  const metadata: {
    description?: string;
    tags?: string[];
    deprecated?: boolean;
    responses?: Array<{ status: number; description: string; schema?: unknown }>;
  } = {};

  if (meta.description !== undefined) {
    metadata.description = meta.description;
  }
  if (meta.tags !== undefined) {
    metadata.tags = meta.tags;
  }
  if (meta.deprecated !== undefined) {
    metadata.deprecated = meta.deprecated;
  }
  if (responses !== undefined) {
    metadata.responses = responses;
  }

  return metadata;
}

/**
 * Recursively collect all .ts files under a directory, sorted for
 * deterministic mount order.
 */
async function collectRouteFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectRouteFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Scan `routesDir` for .ts route files, import each one, validate its default
 * export is a Hono instance, then mount it on `mainApp`.
 *
 * - Logs a warning (does NOT throw) if the directory does not exist.
 * - Throws `RouteLoadError` if a file's default export is not a Hono instance.
 * - Throws `RouteConflictError` if two files register the same method+path.
 */
export async function discoverAndMountRoutes(
  mainApp: Hono<{ Variables: WebLoomVariables }>,
  routesDir: string,
  options: DiscoverRoutesOptions = {}
): Promise<void> {
  // Check directory existence; warn and bail if absent
  try {
    await access(routesDir);
  } catch {
    console.warn(
      `[web-loom] routes.dir "${routesDir}" does not exist — skipping file-based route discovery.`
    );
    return;
  }

  const files = await collectRouteFiles(routesDir);
  const seen = new Map<string, string>(); // "METHOD /path" → filePath
  const basePath = options.basePath ?? '';

  for (const filePath of files) {
    const module = await import(filePath);
    const router: unknown = module.default;

    if (!(router instanceof Hono)) {
      throw new RouteLoadError(
        filePath,
        'default export must be a Hono instance returned by defineRoutes()'
      );
    }

    const mountPath = filePathToMountPath(filePath, routesDir);
    const subRouter = router as Hono<{ Variables: WebLoomVariables }>;
    const discoveredRoutes = new Map<
      string,
      { method: HTTPMethod; path: string; meta?: RouteMetaEntry['meta']; handler: unknown }
    >();

    // Hono stores one entry per handler/middleware in the chain. Collapse those
    // entries into one logical route per method+path before registering.
    for (const route of subRouter.routes) {
      const fullPath = joinPaths(basePath, mountPath, route.path);
      const key = `${route.method.toUpperCase()} ${fullPath}`;
      const existing = discoveredRoutes.get(key);
      const meta = getRouteMeta(route.handler as Parameters<typeof getRouteMeta>[0]);
      const entry: {
        method: HTTPMethod;
        path: string;
        meta?: RouteMetaEntry['meta'];
        handler: unknown;
      } = {
        method: route.method.toUpperCase() as HTTPMethod,
        path: fullPath,
        handler: route.handler,
      };

      const resolvedMeta = meta ?? existing?.meta;
      if (resolvedMeta !== undefined) {
        entry.meta = resolvedMeta;
      }

      discoveredRoutes.set(key, entry);
    }

    for (const [key, route] of discoveredRoutes) {
      if (seen.has(key)) {
        throw new RouteConflictError(route.method, route.path, seen.get(key) ?? filePath, filePath);
      }

      seen.set(key, filePath);

      options.routeRegistry?.register({
        path: route.path,
        method: route.method,
        handler: route.handler as () => Promise<Response>,
        ...(route.meta
          ? {
              metadata: buildRouteMetadata(route.meta),
            }
          : {}),
      });

      if (route.meta) {
        options.routeMetaEntries?.push({
          path: route.path,
          method: route.method,
          meta: route.meta,
        });
      }
    }

    mainApp.route(joinPaths(basePath, mountPath), subRouter);
  }
}
