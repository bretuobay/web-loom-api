/**
 * OpenAPI Spec Generator Utility
 *
 * Discovers routes from src/routes and generates an OpenAPI spec
 * using @web-loom/api-generator-openapi.
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateOpenApiDocument } from '@web-loom/api-generator-openapi';
import type { RouteMetaEntry } from '@web-loom/api-core';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function filePathToUrlPath(relativePath: string): string {
  let urlPath = relativePath
    .replace(/\.(ts|js|tsx|jsx)$/, '')
    .replace(/\\/g, '/')
    .replace(/\[([^\]]+)\]/g, ':$1')
    .replace(/\/index$/, '')
    .replace(/^index$/, '');
  if (!urlPath.startsWith('/')) urlPath = `/${urlPath}`;
  if (urlPath !== '/' && urlPath.endsWith('/')) urlPath = urlPath.slice(0, -1);
  return urlPath || '/';
}

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

export interface SpecGeneratorConfig {
  title?: string;
  version?: string;
  description?: string;
  projectRoot?: string;
}

/** Generate an OpenAPI spec JSON string from file-based routes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateOpenAPISpec(config: SpecGeneratorConfig = {}): any {
  const projectRoot = config.projectRoot || process.cwd();
  const routesDir = path.join(projectRoot, 'src', 'routes');
  const routeMetas: RouteMetaEntry[] = [];

  if (fs.existsSync(routesDir)) {
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
          const tag = urlPath.split('/').filter(Boolean)[0] ?? 'default';

          for (const method of methods) {
            routeMetas.push({
              path: urlPath,
              method,
              meta: {
                summary: rel.replace(/\\/g, '/'), // original relative path as summary
                tags: [tag],
              },
            });
          }
        }
      }
    };
    scan(routesDir);
  }

  const openApiConfig = {
    ...(config.title !== undefined && { title: config.title }),
    ...(config.version !== undefined && { version: config.version }),
    ...(config.description !== undefined && { description: config.description }),
  };
  const doc = generateOpenApiDocument([], routeMetas, openApiConfig);

  return JSON.stringify(doc);
}
