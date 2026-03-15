/**
 * Documentation Server
 * 
 * Serves interactive API documentation using Scalar UI
 */

import * as http from 'http';
import { generateOpenAPISpec, type SpecGeneratorConfig } from './spec-generator.js';

/**
 * Documentation Server
 * Serves OpenAPI spec and Scalar UI
 */
export class DocsServer {
  private server: http.Server | null = null;
  private spec: any = null;

  constructor(
    private projectRoot: string,
    private config: SpecGeneratorConfig = {}
  ) {
    this.config.projectRoot = projectRoot;
  }

  /**
   * Generate OpenAPI specification
   */
  private generateSpec(): any {
    return generateOpenAPISpec(this.config);
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
