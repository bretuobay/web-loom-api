import type { AnyModel } from '@web-loom/api-core';
import { zodToSchema } from '../zod-to-schema';

type SchemaObject = Record<string, unknown>;
type PathsObject = Record<string, Record<string, unknown>>;

const errorSchema: SchemaObject = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['code', 'message'],
    },
  },
  required: ['error'],
};

const standardErrors: Record<string, unknown> = {
  400: { description: 'Validation error', content: { 'application/json': { schema: errorSchema } } },
  401: { description: 'Unauthorized', content: { 'application/json': { schema: errorSchema } } },
  403: { description: 'Forbidden', content: { 'application/json': { schema: errorSchema } } },
  409: { description: 'Conflict', content: { 'application/json': { schema: errorSchema } } },
  500: { description: 'Internal server error', content: { 'application/json': { schema: errorSchema } } },
};

const listQueryParams = [
  {
    name: 'page',
    in: 'query',
    description: 'Page number (1-based)',
    schema: { type: 'integer', default: 1, minimum: 1 },
  },
  {
    name: 'limit',
    in: 'query',
    description: 'Items per page (max 100)',
    schema: { type: 'integer', default: 20, maximum: 100 },
  },
  {
    name: 'sort',
    in: 'query',
    description: 'Comma-separated field names; prefix with - for descending (e.g. -createdAt)',
    schema: { type: 'string' },
  },
  {
    name: 'fields',
    in: 'query',
    description: 'Comma-separated field names to include in response',
    schema: { type: 'string' },
  },
  {
    name: 'search',
    in: 'query',
    description: 'Full-text search string',
    schema: { type: 'string' },
  },
];

function jsonRef(name: string): SchemaObject {
  return { $ref: `#/components/schemas/${name}` };
}

function paginatedWrapper(itemRef: SchemaObject): SchemaObject {
  return {
    type: 'object',
    properties: {
      data: { type: 'array', items: itemRef },
      pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
          hasNext: { type: 'boolean' },
          hasPrev: { type: 'boolean' },
        },
        required: ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev'],
      },
    },
    required: ['data', 'pagination'],
  };
}

/**
 * Builds OpenAPI path items for all six CRUD operations on a model and
 * adds the model's Zod schemas to `components.schemas`.
 */
export function buildCrudPathItems(
  model: AnyModel,
  paths: PathsObject,
  schemas: Record<string, SchemaObject>,
): void {
  const base = model.meta.basePath;
  const name = model.meta.name;

  // Register schemas
  schemas[`${name}Insert`] = zodToSchema(model.insertSchema, `${name}Insert`);
  schemas[`${name}Update`] = zodToSchema(model.updateSchema, `${name}Update`);
  schemas[name] = zodToSchema(model.selectSchema, name);

  const insertRef = jsonRef(`${name}Insert`);
  const updateRef = jsonRef(`${name}Update`);
  const selectRef = jsonRef(name);

  const pkParam = {
    name: 'id',
    in: 'path',
    required: true,
    description: `${name} identifier`,
    schema: { type: 'string' },
  };

  const notFound = {
    description: `${name} not found`,
    content: { 'application/json': { schema: errorSchema } },
  };

  // ── Collection routes (/basePath) ─────────────────────────────────────
  paths[base] = {
    get: {
      summary: `List ${name}s`,
      tags: [name],
      operationId: `list${name}`,
      parameters: listQueryParams,
      responses: {
        200: {
          description: `Paginated list of ${name}s`,
          content: { 'application/json': { schema: paginatedWrapper(selectRef) } },
        },
        ...standardErrors,
      },
    },
    post: {
      summary: `Create ${name}`,
      tags: [name],
      operationId: `create${name}`,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: insertRef } },
      },
      responses: {
        201: {
          description: `${name} created`,
          content: { 'application/json': { schema: selectRef } },
        },
        ...standardErrors,
      },
    },
  };

  // ── Item routes (/basePath/{id}) ─────────────────────────────────────
  paths[`${base}/{id}`] = {
    get: {
      summary: `Get ${name} by ID`,
      tags: [name],
      operationId: `read${name}`,
      parameters: [pkParam],
      responses: {
        200: {
          description: name,
          content: { 'application/json': { schema: selectRef } },
        },
        404: notFound,
        ...standardErrors,
      },
    },
    put: {
      summary: `Replace ${name}`,
      tags: [name],
      operationId: `replace${name}`,
      parameters: [pkParam],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: insertRef } },
      },
      responses: {
        200: {
          description: `${name} replaced`,
          content: { 'application/json': { schema: selectRef } },
        },
        404: notFound,
        ...standardErrors,
      },
    },
    patch: {
      summary: `Update ${name}`,
      tags: [name],
      operationId: `patch${name}`,
      parameters: [pkParam],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: updateRef } },
      },
      responses: {
        200: {
          description: `${name} updated`,
          content: { 'application/json': { schema: selectRef } },
        },
        404: notFound,
        ...standardErrors,
      },
    },
    delete: {
      summary: `Delete ${name}`,
      tags: [name],
      operationId: `delete${name}`,
      parameters: [pkParam],
      responses: {
        204: { description: `${name} deleted` },
        404: notFound,
        ...standardErrors,
      },
    },
  };
}
