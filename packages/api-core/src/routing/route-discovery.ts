import { Hono } from 'hono';
import { readdir, stat, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { WebLoomVariables } from '../types';
import { filePathToMountPath } from './path-utils';
import { RouteLoadError, RouteConflictError } from './errors';

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

    // Conflict detection: inspect registered routes on the sub-router
    for (const route of (router as Hono).routes) {
      const key = `${route.method.toUpperCase()} ${mountPath === '/' ? '' : mountPath}${route.path}`;
      if (seen.has(key)) {
        throw new RouteConflictError(
          route.method.toUpperCase(),
          key.slice(route.method.length + 1),
          seen.get(key)!,
          filePath
        );
      }
      seen.set(key, filePath);
    }

    mainApp.route(mountPath, router as Hono);
  }
}
