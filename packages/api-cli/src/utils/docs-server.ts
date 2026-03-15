/**
 * Documentation Server
 * 
 * Serves interactive API documentation using Scalar UI
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAPIGenerator } from '@web-loom/api-generator-openapi';
import type { ModelDefinition } from '@web-loom/api-generator-openapi';

interface RouteDefinition {
  path: string;
  method: string;
  handler: string;
  validation?: {
    body?: any;
    params?: any;
    query?: any;
  };
  auth?: {
    required: boolean;
    roles?: string[];
  };
}

/**
 * Documentation Server
 * Serves OpenAPI spec and Scalar UI
 */
export class DocsServer {
  private server: http.Server | null = null;
  private generator: OpenAPIGenerator;
  private spec: any = null;

  constructor(
    private projectRoot: string,
    private config: {
      title?: string;
      version?: string;
      description?: string;
    } = {}
  ) {
    this.generator = new OpenAPIGenerator({
      title: config.title || 'Web Loom API',
      version: config.version || '1.0.0',
      description: config.description || 'API documentation',
    });
  }

  /**
   * Discover routes from src/routes directory
   */
  private discoverRoutes(): RouteDefinition[] {
    const routes: RouteDefinition[] = [];
    const routesDir = path.join(this.projectRoot, 'src', 'routes');

    if (!fs.existsSync(routesDir)) {
      return routes;
    }

    const scanDirectory = (dir: string, basePath: string = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(routesDir, fullPath);

        if (entry.isDirectory()) {
          scanDirectory(fullPath, basePath + '/' + entry.name);
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
  private discoverModels(): ModelDefinition[] {
    const models: ModelDefinition[] = [];
    const modelsDir = path.join(this.projectRoot, 'src', 'models');

    if (!fs.existsSync(modelsDir)) {
      return models;
    }

    // For now, return empty array
    // In a real implementation, we would parse model files
    return models;
  }

  /**
   * Generate OpenAPI specification
   */
  private generateSpec(): any {
    // Discover routes and models
    const routes = this.discoverRoutes();
    const models = this.discoverModels();

    // Register models
    for (const model of models) {
      this.generator.registerModel(model);
    }

    // Register routes
    for (const route of routes) {
      this.generator.registerRoute({
        path: route.path,
        method: route.method.toLowerCase() as any,
        summary: `${route.method} ${route.path}`,
        description: `Handler: ${route.handler}`,
        tags: [route.path.split('/')[1] || 'default'],
        validation: route.validation,
        auth: route.auth,
      });
    }

    return this.generator.toJSON();
  }

  /**
   * Refresh the OpenAPI spec
   */
  refreshSpec(): void {
    this.spec = this.generateSpec();
  }

  /**
   * Get Scalar HTML page
   */
  private getScalarHTML(specUrl: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>API Documentation - ${this.config.title || 'Web Loom API'}</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script
    id="api-reference"
    data-url="${specUrl}"
  ></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
  }

  /**
   * Start the documentation server
   */
  start(port: number, host: string = 'localhost'): Promise<void> {
    return new Promise((resolve, reject) => {
      // Generate initial spec
      this.refreshSpec();

      this.server = http.createServer((req, res) => {
        const url = req.url || '/';

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        // Serve OpenAPI spec JSON
        if (url === '/openapi.json' || url === '/api/openapi.json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.spec, null, 2));
          return;
        }

        // Serve Scalar UI
        if (url === '/' || url === '/docs' || url === '/api/docs') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.getScalarHTML('/openapi.json'));
          return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      });

      this.server.on('error', reject);

      this.server.listen(port, host, () => {
        resolve();
      });
    });
  }

  /**
   * Stop the documentation server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the server instance
   */
  getServer(): http.Server | null {
    return this.server;
  }
}
