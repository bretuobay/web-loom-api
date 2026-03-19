# Design: OpenAPI Generator

## Overview

The OpenAPI generator reads the model registry and route metadata to produce an OpenAPI 3.1 document. Zod schemas are converted to JSON Schema via `zod-to-json-schema`. The document is served live at `/openapi.json`.

```
ModelRegistry.getAll()          Route metadata (openApiMeta())
      │                                    │
      ▼                                    ▼
 CRUD path items              Hand-written path items
      │                                    │
      └─────────────┬──────────────────────┘
                    ▼
          OpenAPI 3.1 Document
          ├── info (from config)
          ├── servers
          ├── paths (all operations)
          └── components.schemas (Zod → JSON Schema)
                    │
                    ├── GET /openapi.json
                    ├── GET /openapi.yaml
                    └── GET /docs (Swagger UI or Scalar)
```

## openApiMeta() Middleware

```typescript
// packages/api-core/src/routing/open-api-meta.ts

const ROUTE_META_KEY = Symbol('webloom:routeMeta');

export interface RouteMeta {
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  deprecated?: boolean;
  request?: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
    headers?: ZodSchema;
  };
  responses?: Record<number, { description: string; schema?: ZodSchema }>;
}

/** Attaches metadata to a route for OpenAPI generation. No runtime effect on requests. */
export function openApiMeta(meta: RouteMeta): MiddlewareHandler {
  const middleware: MiddlewareHandler = async (_c, next) => next();
  (middleware as any)[ROUTE_META_KEY] = meta;
  return middleware;
}

export function getRouteMeta(middleware: MiddlewareHandler): RouteMeta | undefined {
  return (middleware as any)[ROUTE_META_KEY];
}
```

Usage:

```typescript
app.get('/users/export',
  openApiMeta({
    summary: 'Export all users as CSV',
    tags: ['users'],
    responses: {
      200: { description: 'CSV file', schema: z.string() },
    },
  }),
  async (c) => { /* ... */ }
);
```

## OpenAPI Document Generator

```typescript
// packages/api-generators/openapi/src/generate-openapi.ts

import { zodToJsonSchema } from 'zod-to-json-schema';
import type { OpenAPIV3_1 } from 'openapi-types';

export function generateOpenApiDocument(
  models: Model<any>[],
  routeMetas: RouteMetaEntry[],
  config: OpenApiConfig
): OpenAPIV3_1.Document {
  const schemas: Record<string, OpenAPIV3_1.SchemaObject> = {};
  const paths: OpenAPIV3_1.PathsObject = {};

  // 1. Build CRUD path items from models
  for (const model of models) {
    if (!model.meta.crud) continue;
    buildCrudPathItems(model, paths, schemas);
  }

  // 2. Build hand-written path items from route metadata
  for (const entry of routeMetas) {
    buildHandWrittenPathItem(entry, paths, schemas);
  }

  return {
    openapi: '3.1.0',
    info: config.info ?? { title: 'Web Loom API', version: '1.0.0' },
    servers: config.servers ?? [{ url: '/' }],
    paths,
    components: { schemas },
  };
}

function zodToSchema(
  schema: ZodSchema,
  name: string,
  schemas: Record<string, OpenAPIV3_1.SchemaObject>
): OpenAPIV3_1.ReferenceObject {
  try {
    const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' });
    schemas[name] = jsonSchema as OpenAPIV3_1.SchemaObject;
    return { $ref: `#/components/schemas/${name}` };
  } catch {
    console.warn(`[openapi] Cannot convert schema "${name}" to JSON Schema — using any-type`);
    schemas[name] = {};
    return { $ref: `#/components/schemas/${name}` };
  }
}
```

## CRUD Path Items Builder

```typescript
function buildCrudPathItems(
  model: Model<any>,
  paths: OpenAPIV3_1.PathsObject,
  schemas: Record<string, OpenAPIV3_1.SchemaObject>
) {
  const base = model.meta.basePath;
  const name = model.meta.name;

  // Register schemas
  const insertRef = zodToSchema(model.insertSchema, `${name}Insert`, schemas);
  const selectRef = zodToSchema(model.selectSchema, `${name}`, schemas);
  const updateRef = zodToSchema(model.updateSchema, `${name}Update`, schemas);

  const pkParam: OpenAPIV3_1.ParameterObject = {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string' },
  };

  const notFound: OpenAPIV3_1.ResponseObject = {
    description: `${name} not found`,
    content: { 'application/json': { schema: errorSchema } },
  };

  paths[base] = {
    get: {
      summary: `List ${name}s`,
      tags: [name],
      operationId: `list${name}`,
      parameters: listQueryParams,
      responses: {
        200: { description: 'Paginated list', content: { 'application/json': { schema: paginatedSchema(selectRef) } } },
        ...standardErrorResponses,
      },
    },
    post: {
      summary: `Create ${name}`,
      tags: [name],
      operationId: `create${name}`,
      requestBody: { required: true, content: { 'application/json': { schema: insertRef } } },
      responses: {
        201: { description: `${name} created`, content: { 'application/json': { schema: selectRef } } },
        ...standardErrorResponses,
      },
    },
  };

  paths[`${base}/{id}`] = {
    get: {
      summary: `Get ${name} by ID`,
      operationId: `read${name}`,
      tags: [name],
      parameters: [pkParam],
      responses: {
        200: { description: name, content: { 'application/json': { schema: selectRef } } },
        404: notFound,
        ...standardErrorResponses,
      },
    },
    put: { /* replace */ },
    patch: {
      summary: `Update ${name}`,
      operationId: `patch${name}`,
      tags: [name],
      parameters: [pkParam],
      requestBody: { required: true, content: { 'application/json': { schema: updateRef } } },
      responses: { /* ... */ },
    },
    delete: { /* ... */ },
  };
}
```

## Live Serving

```typescript
// packages/api-generators/openapi/src/serve-openapi.ts

export function registerOpenApiRoutes(
  app: Hono,
  generator: () => OpenAPIV3_1.Document
): void {
  app.get('/openapi.json', (c) => c.json(generator()));
  app.get('/openapi.yaml', (c) => {
    const yaml = require('js-yaml').dump(generator());
    return c.text(yaml, 200, { 'Content-Type': 'text/yaml' });
  });
}

export function registerSwaggerUI(app: Hono): void {
  app.get('/docs', swaggerUI({ url: '/openapi.json' }));
}

export function registerScalarUI(app: Hono): void {
  app.get('/docs', apiReference({ spec: { url: '/openapi.json' } }));
}
```

## Dependencies

- `zod-to-json-schema` — Zod → JSON Schema conversion
- `openapi-types` — TypeScript types for OpenAPI 3.1
- `@hono/swagger-ui` — Swagger UI middleware
- `@scalar/hono-api-reference` — Scalar UI middleware
- `js-yaml` — YAML serialisation (CLI only, not in runtime bundle)
