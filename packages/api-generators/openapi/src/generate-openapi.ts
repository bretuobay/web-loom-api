import type { AnyModel, OpenApiConfig, RouteMetaEntry } from '@web-loom/api-core';
import { buildCrudPathItems } from './builders/crud-paths';
import { buildManualPathItems } from './builders/manual-paths';

type SchemaObject = Record<string, unknown>;
type PathsObject = Record<string, Record<string, unknown>>;

export interface OpenApiDocument {
  openapi: '3.1.0';
  info: { title: string; version: string; description?: string };
  servers: Array<{ url: string; description?: string }>;
  paths: PathsObject;
  components: { schemas: Record<string, SchemaObject> };
}

/**
 * Generates an OpenAPI 3.1 document from registered models and route metadata.
 *
 * @param models      - Models from the model registry (filter to those with `crud` enabled)
 * @param routeMetas  - Hand-written route metadata entries collected via `openApiMeta()`
 * @param config      - OpenAPI config from `webloom.config.ts`
 */
export function generateOpenApiDocument(
  models: AnyModel[],
  routeMetas: RouteMetaEntry[],
  config: OpenApiConfig,
): OpenApiDocument {
  const schemas: Record<string, SchemaObject> = {};
  const paths: PathsObject = {};

  // CRUD routes
  for (const model of models) {
    if (!model.meta.crud) continue;
    buildCrudPathItems(model, paths, schemas);
  }

  // Hand-written routes
  buildManualPathItems(routeMetas, paths, schemas);

  return {
    openapi: '3.1.0',
    info: {
      title: config.title ?? 'Web Loom API',
      version: config.version ?? '1.0.0',
      ...(config.description && { description: config.description }),
    },
    servers: [{ url: '/' }],
    paths,
    components: { schemas },
  };
}
