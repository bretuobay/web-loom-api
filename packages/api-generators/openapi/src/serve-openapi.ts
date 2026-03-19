import type { Hono } from 'hono';
import type { AnyModel, OpenApiConfig, RouteMetaEntry } from '@web-loom/api-core';
import { generateOpenApiDocument } from './generate-openapi';
import type { OpenApiDocument } from './generate-openapi';

/**
 * Registers OpenAPI serving routes on the provided Hono app:
 * - `GET /openapi.json` — live JSON document
 * - `GET /openapi.yaml` — live YAML document (requires `js-yaml` at runtime)
 * - `GET /docs`         — Swagger UI or Scalar (based on `config.ui`)
 *
 * Skipped entirely when `config.enabled === false`.
 */
export async function setupOpenApiRoutes(
  app: Hono<any>,
  models: AnyModel[],
  routeMetas: RouteMetaEntry[],
  config: OpenApiConfig
): Promise<void> {
  if (config.enabled === false) return;

  // Lazily build the document on first request (models may still be registering)
  let cached: OpenApiDocument | null = null;
  const getDoc = (): OpenApiDocument => {
    if (!cached) cached = generateOpenApiDocument(models, routeMetas, config);
    return cached;
  };

  app.get('/openapi.json', (c) => c.json(getDoc()));

  app.get('/openapi.yaml', async (c) => {
    try {
      const jsYaml = await import('js-yaml');
      const yaml = jsYaml.dump(getDoc());
      return c.text(yaml, 200, { 'Content-Type': 'text/yaml' });
    } catch {
      return c.json({ error: { code: 'UNAVAILABLE', message: 'js-yaml is not installed' } }, 503);
    }
  });

  const ui = config.ui ?? 'swagger';

  if (ui === 'swagger') {
    try {
      const { swaggerUI } = await import('@hono/swagger-ui');
      app.get('/docs', swaggerUI({ url: '/openapi.json' }));
    } catch {
      // @hono/swagger-ui not installed — skip UI route
    }
  } else if (ui === 'scalar') {
    try {
      const { apiReference } = await import('@scalar/hono-api-reference');
      app.get('/docs', (apiReference as any)({ url: '/openapi.json' }));
    } catch {
      // @scalar/hono-api-reference not installed — skip UI route
    }
  }
}
