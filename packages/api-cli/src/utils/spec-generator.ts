/**
 * OpenAPI Spec Generator Utility
 * 
 * Discovers routes and models from project and generates OpenAPI spec
 */

import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore - module may not be installed
import { OpenAPIGenerator } from '@web-loom/api-generator-openapi';
// @ts-ignore - module may not be installed
import type { ModelDefinition } from '@web-loom/api-generator-openapi';

interface RouteDefinition {
  path: string;
  method: string;
  handler: string;
  validation?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query?: any;
  };
  auth?: {
    required: boolean;
    roles?: string[];
  };
}

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

  // Discover routes and models
  const routes = discoverRoutes(projectRoot);
  const models = discoverModels(projectRoot);

  // Register models
  for (const model of models) {
    generator.registerModel(model);
  }

  // Register routes
  for (const route of routes) {
    generator.registerRoute({
      path: route.path,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      method: route.method.toLowerCase() as any,
      description: `${route.method} ${route.path} - Handler: ${route.handler}`,
      tags: [route.path.split('/')[1] || 'default'],
      validation: route.validation,
      auth: route.auth,
    });
  }

  return generator.toJSON();
}

/**
 * Discover routes from src/routes directory
 */
function discoverRoutes(projectRoot: string): RouteDefinition[] {
  const routes: RouteDefinition[] = [];
  const routesDir = path.join(projectRoot, 'src', 'routes');

  if (!fs.existsSync(routesDir)) {
    return routes;
  }

  const scanDirectory = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(routesDir, fullPath);

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        // Convert file path to URL path
        let urlPath = relativePath
          .replace(/\.(ts|js)$/, '')
          .replace(/\\/g, '/')
          .replace(/\[([^\]]+)\]/g, ':$1')
          .replace(/index$/, '');

        if (!urlPath.startsWith('/')) {
          urlPath = '/' + urlPath;
        }

        // Remove trailing slash except for root
        if (urlPath !== '/' && urlPath.endsWith('/')) {
          urlPath = urlPath.slice(0, -1);
        }

        // Add route for each HTTP method (we'll discover actual methods later)
        const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
        for (const method of methods) {
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

  // For now, return empty array
  // In a real implementation, we would parse model files
  return models;
}
