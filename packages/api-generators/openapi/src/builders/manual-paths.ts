import type { RouteMetaEntry } from '@web-loom/api-core';
import { zodToSchema } from '../zod-to-schema';

type SchemaObject = Record<string, unknown>;
type PathsObject = Record<string, Record<string, unknown>>;

/** Convert Hono path syntax (/users/:id) to OpenAPI path syntax (/users/{id}). */
function toOpenApiPath(path: string): string {
  return path.replace(/:(\w+)/g, '{$1}');
}

/**
 * Builds an OpenAPI path item operation from a `RouteMetaEntry`.
 * Registers any request/response Zod schemas in `components.schemas`.
 */
export function buildManualPathItems(
  entries: RouteMetaEntry[],
  paths: PathsObject,
  schemas: Record<string, SchemaObject>,
): void {
  for (const entry of entries) {
    const { path, method, meta } = entry;
    const openApiPath = toOpenApiPath(path);
    const httpMethod = method.toLowerCase();
    const operationId = meta.operationId ?? `${httpMethod}${openApiPath.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const operation: Record<string, unknown> = {};

    if (meta.summary) operation['summary'] = meta.summary;
    if (meta.description) operation['description'] = meta.description;
    if (meta.tags) operation['tags'] = meta.tags;
    if (meta.deprecated) operation['deprecated'] = meta.deprecated;
    operation['operationId'] = operationId;

    // ── Parameters (query + params) ─────────────────────────────────────
    const parameters: unknown[] = [];

    if (meta.request?.params) {
      const paramSchema = zodToSchema(meta.request.params, `${operationId}Params`);
      const props = paramSchema['properties'] as Record<string, SchemaObject> | undefined;
      if (props) {
        const required = (paramSchema['required'] as string[]) ?? [];
        for (const [paramName, paramSch] of Object.entries(props)) {
          parameters.push({
            name: paramName,
            in: 'path',
            required: true,
            schema: paramSch,
          });
          void required;
        }
      }
    }

    if (meta.request?.query) {
      const querySchema = zodToSchema(meta.request.query, `${operationId}Query`);
      const props = querySchema['properties'] as Record<string, SchemaObject> | undefined;
      if (props) {
        const required = (querySchema['required'] as string[]) ?? [];
        for (const [queryName, querySch] of Object.entries(props)) {
          parameters.push({
            name: queryName,
            in: 'query',
            required: required.includes(queryName),
            schema: querySch,
          });
        }
      }
    }

    if (parameters.length > 0) operation['parameters'] = parameters;

    // ── Request body ─────────────────────────────────────────────────────
    if (meta.request?.body) {
      const bodySchemaName = `${operationId}Body`;
      schemas[bodySchemaName] = zodToSchema(meta.request.body, bodySchemaName);
      operation['requestBody'] = {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${bodySchemaName}` },
          },
        },
      };
    }

    // ── Responses ─────────────────────────────────────────────────────────
    const responses: Record<string, unknown> = {};
    if (meta.responses) {
      for (const [statusCode, resp] of Object.entries(meta.responses)) {
        if (resp.schema) {
          const respSchemaName = `${operationId}Response${statusCode}`;
          schemas[respSchemaName] = zodToSchema(resp.schema, respSchemaName);
          responses[statusCode] = {
            description: resp.description,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${respSchemaName}` },
              },
            },
          };
        } else {
          responses[statusCode] = { description: resp.description };
        }
      }
    }
    if (Object.keys(responses).length === 0) {
      responses['200'] = { description: 'Success' };
    }
    operation['responses'] = responses;

    // ── Merge into paths ──────────────────────────────────────────────────
    if (!paths[openApiPath]) paths[openApiPath] = {};
    paths[openApiPath]![httpMethod] = operation;
  }
}
