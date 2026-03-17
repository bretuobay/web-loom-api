/**
 * OpenAPI Spec Generator Utility
 *
 * Discovers routes and models from project and generates OpenAPI spec
 */

import * as fs from 'fs';
import * as path from 'path';
import type { RouteDefinition } from '@web-loom/api-core';
import type { HTTPMethod } from '@web-loom/api-shared';
// @ts-ignore - module may not be installed
import { OpenAPIGenerator } from '@web-loom/api-generator-openapi';
// @ts-ignore - module may not be installed
import type { ModelDefinition } from '@web-loom/api-generator-openapi';

interface DiscoveredRoute {
  path: string;
  method: HTTPMethod;
  handler: string;
  validation?: RouteDefinition['validation'];
  auth?: RouteDefinition['auth'];
}

const HTTP_METHODS: HTTPMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const placeholderHandler: RouteDefinition['handler'] = () =>
  new Response(JSON.stringify({ error: 'Not implemented' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });

export interface SpecGeneratorConfig {
  title?: string;
  version?: string;
  description?: string;
  projectRoot?: string;
}

/**
 * Generate OpenAPI specification from project
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateOpenAPISpec(config: SpecGeneratorConfig = {}): any {
  const projectRoot = config.projectRoot || process.cwd();

  const generator = new OpenAPIGenerator({
    title: config.title || 'Web Loom API',
    version: config.version || '1.0.0',
    description: config.description || 'API documentation',
  });

  const routes = discoverRoutes(projectRoot);
  const models = discoverModels(projectRoot);

  for (const model of models) {
    generator.registerModel(model);
  }

  for (const route of routes) {
    const routeDefinition: RouteDefinition = {
      path: route.path,
      method: route.method,
      handler: placeholderHandler,
      metadata: {
        description: route.handler,
        tags: [route.path.split('/')[1] || 'default'],
      },
    };

    if (route.validation !== undefined) {
      routeDefinition.validation = route.validation;
    }

    if (route.auth !== undefined) {
      routeDefinition.auth = route.auth;
    }

    generator.registerRoute(routeDefinition);
  }

  return generator.toJSON();
}

/**
 * Discover routes from src/routes directory
 */
function discoverRoutes(projectRoot: string): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];
  const routesDir = path.join(projectRoot, 'src', 'routes');

  if (!fs.existsSync(routesDir)) {
    return routes;
  }

  const scanDirectory = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(routesDir, fullPath);

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        let urlPath = relativePath
          .replace(/\.(ts|js)$/, '')
          .replace(/\\/g, '/')
          .replace(/\[([^\]]+)\]/g, ':$1')
          .replace(/index$/, '');

        if (!urlPath.startsWith('/')) {
          urlPath = `/${urlPath}`;
        }

        if (urlPath !== '/' && urlPath.endsWith('/')) {
          urlPath = urlPath.slice(0, -1);
        }

        for (const method of HTTP_METHODS) {
          routes.push({
            path: urlPath,
            method,
            handler: relativePath,
          });
        }
      }
    }
  };

  scanDirectory(routesDir);
  return routes;
}

/**
 * Discover models from src/models directory
 */
function discoverModels(projectRoot: string): ModelDefinition[] {
  const models: ModelDefinition[] = [];
  const modelsDir = path.join(projectRoot, 'src', 'models');

  if (!fs.existsSync(modelsDir)) {
    return models;
  }

  return models;
}

