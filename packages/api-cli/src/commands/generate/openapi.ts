/**
 * Generate OpenAPI Command
 *
 * Generates an OpenAPI 3.1 specification from file-based routes.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { generateOpenApiDocument } from '@web-loom/api-generator-openapi';
import type { RouteMetaEntry } from '@web-loom/api-core';

// ── Route discovery ───────────────────────────────────────────────────────────

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/** Convert a route file's relative path to a Hono-style URL path. */
function filePathToUrlPath(relativePath: string): string {
  let urlPath = relativePath
    .replace(/\.(ts|js|tsx|jsx)$/, '')
    .replace(/\\/g, '/')
    .replace(/\[([^\]]+)\]/g, ':$1') // [param] → :param
    .replace(/\/index$/, '') // strip /index suffix
    .replace(/^index$/, ''); // strip bare index

  if (!urlPath.startsWith('/')) urlPath = `/${urlPath}`;
  if (urlPath !== '/' && urlPath.endsWith('/')) urlPath = urlPath.slice(0, -1);
  return urlPath || '/';
}

/** Read a route file and return the HTTP methods it exports. */
function readExportedMethods(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const found = HTTP_METHODS.filter((m) =>
      new RegExp(`export\\s+(const|function|async)\\s+${m}\\b`).test(content)
    );
    return found.length > 0 ? found : ['GET'];
  } catch {
    return ['GET'];
  }
}

/** Recursively scan a directory and collect `RouteMetaEntry` items. */
function discoverRoutes(routesDir: string): RouteMetaEntry[] {
  const entries: RouteMetaEntry[] = [];

  if (!fs.existsSync(routesDir)) return entries;

  const scan = (dir: string): void => {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        scan(full);
      } else if (item.isFile() && /\.(ts|js|tsx|jsx)$/.test(item.name)) {
        const rel = path.relative(routesDir, full);
        const urlPath = filePathToUrlPath(rel);
        const methods = readExportedMethods(full);
        for (const method of methods) {
          entries.push({
            path: urlPath,
            method,
            meta: {
              operationId: buildOperationId(method, urlPath),
              summary: `${method} ${urlPath}`,
              tags: [urlPath.split('/').filter(Boolean)[0] ?? 'default'],
            },
          });
        }
      }
    }
  };

  scan(routesDir);
  return entries;
}

/** Build an operationId from method + path (e.g. GET /users/:id → getUsersById). */
function buildOperationId(method: string, urlPath: string): string {
  const segments = urlPath
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      if (seg.startsWith(':')) {
        return 'By' + seg[1]!.toUpperCase() + seg.slice(2);
      }
      return seg[0]!.toUpperCase() + seg.slice(1);
    });

  if (segments.length === 0) segments.push('Index');
  return method.toLowerCase() + segments.join('');
}

// ── Command ───────────────────────────────────────────────────────────────────

export const createGenerateOpenAPICommand = (): Command => {
  return new Command('openapi')
    .description('Generate OpenAPI 3.1 specification from file-based routes')
    .option('-o, --output <path>', 'Output file path', 'openapi.json')
    .option('-f, --format <format>', 'Output format: json or yaml', 'json')
    .option('-t, --title <title>', 'API title', 'Web Loom API')
    .option('-v, --version <version>', 'API version', '1.0.0')
    .option('-d, --description <description>', 'API description')
    .option('--routes-dir <dir>', 'Routes directory to scan', 'src/routes')
    .action(
      async (options: {
        output: string;
        format: string;
        title: string;
        version: string;
        description?: string;
        routesDir: string;
      }) => {
        try {
          if (options.format !== 'json' && options.format !== 'yaml') {
            console.error('Invalid format. Must be "json" or "yaml"');
            process.exit(1);
          }

          const projectRoot = process.cwd();
          const routesDir = path.isAbsolute(options.routesDir)
            ? options.routesDir
            : path.join(projectRoot, options.routesDir);

          const routeMetas = discoverRoutes(routesDir);

          const doc = generateOpenApiDocument([], routeMetas, {
            title: options.title,
            version: options.version,
            ...(options.description && { description: options.description }),
          });

          let outputPath = path.isAbsolute(options.output)
            ? options.output
            : path.join(projectRoot, options.output);

          if (options.format === 'yaml') {
            if (!outputPath.endsWith('.yaml') && !outputPath.endsWith('.yml')) {
              outputPath = outputPath.replace(/\.[^.]+$/, '.yaml');
            }
          } else {
            if (!outputPath.endsWith('.json')) {
              outputPath = outputPath.replace(/\.[^.]+$/, '.json');
            }
          }

          const outputDir = path.dirname(outputPath);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          const content =
            options.format === 'yaml'
              ? yaml.stringify(doc)
              : JSON.stringify(doc, null, 2);

          fs.writeFileSync(outputPath, content, 'utf-8');

          const relOut = path.relative(projectRoot, outputPath);
          const pathCount = Object.keys(doc.paths).length;
          const opCount = Object.values(doc.paths).reduce(
            (n, item) =>
              n +
              Object.keys(item).filter((k) =>
                ['get', 'post', 'put', 'patch', 'delete'].includes(k)
              ).length,
            0
          );

          console.log(`OpenAPI specification written to ${relOut}`);
          console.log(`  Format:     ${options.format.toUpperCase()}`);
          console.log(`  Title:      ${options.title} v${options.version}`);
          console.log(`  Paths:      ${pathCount}`);
          console.log(`  Operations: ${opCount}`);
        } catch (error) {
          console.error(
            'Error generating OpenAPI spec:',
            error instanceof Error ? error.message : error
          );
          process.exit(1);
        }
      }
    );
};
