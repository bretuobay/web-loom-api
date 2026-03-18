import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { createSelectSchema, createInsertSchema } from 'drizzle-zod';
import { zodToSchema } from '../zod-to-schema';
import { buildCrudPathItems } from '../builders/crud-paths';
import { buildManualPathItems } from '../builders/manual-paths';
import { generateOpenApiDocument } from '../generate-openapi';
import type { AnyModel } from '@web-loom/api-core';
import type { RouteMetaEntry } from '@web-loom/api-core';

// ── Helpers ───────────────────────────────────────────────────────────────────

const usersTable = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
});

function makeModel(overrides: Partial<AnyModel['meta']> = {}): AnyModel {
  const selectSchema = createSelectSchema(usersTable);
  const insertSchema = createInsertSchema(usersTable);
  return {
    table: usersTable,
    meta: {
      name: 'User',
      basePath: '/users',
      crud: true,
      ...overrides,
    },
    selectSchema,
    insertSchema,
    updateSchema: insertSchema.partial(),
  } as unknown as AnyModel;
}

// ── zodToSchema ───────────────────────────────────────────────────────────────

describe('zodToSchema', () => {
  it('converts a string schema', () => {
    const result = zodToSchema(z.string(), 'MyString');
    expect(result['type']).toBe('string');
    expect(result['$schema']).toBeUndefined();
  });

  it('converts a number schema', () => {
    const result = zodToSchema(z.number(), 'MyNumber');
    expect(result['type']).toBe('number');
  });

  it('converts an object schema', () => {
    const result = zodToSchema(z.object({ id: z.string(), age: z.number() }), 'Obj');
    expect(result['type']).toBe('object');
    const props = result['properties'] as Record<string, unknown>;
    expect(props['id']).toMatchObject({ type: 'string' });
    expect(props['age']).toMatchObject({ type: 'number' });
  });

  it('handles nullable fields', () => {
    const result = zodToSchema(z.object({ name: z.string().nullable() }), 'WithNull');
    const props = result['properties'] as Record<string, unknown>;
    expect(props['name']).toBeDefined();
  });

  it('handles optional fields', () => {
    const result = zodToSchema(z.object({ bio: z.string().optional() }), 'WithOpt');
    expect(result['type']).toBe('object');
  });

  it('handles ZodDefault', () => {
    const result = zodToSchema(z.string().default('hello'), 'WithDefault');
    expect(result).toBeDefined();
  });

  it('handles array schema', () => {
    const result = zodToSchema(z.array(z.string()), 'StrArray');
    expect(result['type']).toBe('array');
    expect((result['items'] as Record<string, unknown>)['type']).toBe('string');
  });

  it('strips $schema field from output', () => {
    const result = zodToSchema(z.string(), 'Bare');
    expect(result['$schema']).toBeUndefined();
  });
});

// ── buildCrudPathItems ────────────────────────────────────────────────────────

describe('buildCrudPathItems', () => {
  it('adds collection and item path keys', () => {
    const model = makeModel();
    const paths: Record<string, Record<string, unknown>> = {};
    const schemas: Record<string, Record<string, unknown>> = {};
    buildCrudPathItems(model, paths, schemas);

    expect(paths['/users']).toBeDefined();
    expect(paths['/users/{id}']).toBeDefined();
  });

  it('sets correct operationIds', () => {
    const model = makeModel();
    const paths: Record<string, Record<string, unknown>> = {};
    const schemas: Record<string, Record<string, unknown>> = {};
    buildCrudPathItems(model, paths, schemas);

    expect((paths['/users']!['get'] as any).operationId).toBe('listUser');
    expect((paths['/users']!['post'] as any).operationId).toBe('createUser');
    expect((paths['/users/{id}']!['get'] as any).operationId).toBe('readUser');
    expect((paths['/users/{id}']!['put'] as any).operationId).toBe('replaceUser');
    expect((paths['/users/{id}']!['patch'] as any).operationId).toBe('patchUser');
    expect((paths['/users/{id}']!['delete'] as any).operationId).toBe('deleteUser');
  });

  it('sets tags to model name on all operations', () => {
    const model = makeModel();
    const paths: Record<string, Record<string, unknown>> = {};
    const schemas: Record<string, Record<string, unknown>> = {};
    buildCrudPathItems(model, paths, schemas);

    for (const method of ['get', 'post']) {
      expect((paths['/users']![method] as any).tags).toContain('User');
    }
    for (const method of ['get', 'put', 'patch', 'delete']) {
      expect((paths['/users/{id}']![method] as any).tags).toContain('User');
    }
  });

  it('adds list query parameters to GET /', () => {
    const model = makeModel();
    const paths: Record<string, Record<string, unknown>> = {};
    const schemas: Record<string, Record<string, unknown>> = {};
    buildCrudPathItems(model, paths, schemas);

    const params = (paths['/users']!['get'] as any).parameters as any[];
    const paramNames = params.map((p: any) => p.name);
    expect(paramNames).toContain('page');
    expect(paramNames).toContain('limit');
    expect(paramNames).toContain('sort');
    expect(paramNames).toContain('fields');
    expect(paramNames).toContain('search');
  });

  it('sets id path parameter on item routes', () => {
    const model = makeModel();
    const paths: Record<string, Record<string, unknown>> = {};
    const schemas: Record<string, Record<string, unknown>> = {};
    buildCrudPathItems(model, paths, schemas);

    const readParams = (paths['/users/{id}']!['get'] as any).parameters as any[];
    const idParam = readParams.find((p: any) => p.name === 'id');
    expect(idParam).toBeDefined();
    expect(idParam.in).toBe('path');
    expect(idParam.required).toBe(true);
  });

  it('registers Insert, Update, and Select schemas in components', () => {
    const model = makeModel();
    const paths: Record<string, Record<string, unknown>> = {};
    const schemas: Record<string, Record<string, unknown>> = {};
    buildCrudPathItems(model, paths, schemas);

    expect(schemas['UserInsert']).toBeDefined();
    expect(schemas['UserUpdate']).toBeDefined();
    expect(schemas['User']).toBeDefined();
  });

  it('references insertSchema for POST requestBody', () => {
    const model = makeModel();
    const paths: Record<string, Record<string, unknown>> = {};
    const schemas: Record<string, Record<string, unknown>> = {};
    buildCrudPathItems(model, paths, schemas);

    const rb = (paths['/users']!['post'] as any).requestBody;
    expect(rb.content['application/json'].schema.$ref).toContain('UserInsert');
  });

  it('references updateSchema for PATCH requestBody', () => {
    const model = makeModel();
    const paths: Record<string, Record<string, unknown>> = {};
    const schemas: Record<string, Record<string, unknown>> = {};
    buildCrudPathItems(model, paths, schemas);

    const rb = (paths['/users/{id}']!['patch'] as any).requestBody;
    expect(rb.content['application/json'].schema.$ref).toContain('UserUpdate');
  });

  it('documents standard error responses on all operations', () => {
    const model = makeModel();
    const paths: Record<string, Record<string, unknown>> = {};
    const schemas: Record<string, Record<string, unknown>> = {};
    buildCrudPathItems(model, paths, schemas);

    const listOp = paths['/users']!['get'] as any;
    expect(listOp.responses[400]).toBeDefined();
    expect(listOp.responses[401]).toBeDefined();
    expect(listOp.responses[409]).toBeDefined();
    expect(listOp.responses[500]).toBeDefined();
  });
});

// ── buildManualPathItems ──────────────────────────────────────────────────────

describe('buildManualPathItems', () => {
  it('builds a path item from a RouteMetaEntry', () => {
    const entries: RouteMetaEntry[] = [
      {
        path: '/export',
        method: 'GET',
        meta: {
          summary: 'Export CSV',
          tags: ['export'],
          operationId: 'exportCsv',
          responses: { 200: { description: 'CSV file', schema: z.string() } },
        },
      },
    ];

    const paths: Record<string, Record<string, unknown>> = {};
    const schemas: Record<string, Record<string, unknown>> = {};
    buildManualPathItems(entries, paths, schemas);

    expect(paths['/export']).toBeDefined();
    const op = paths['/export']!['get'] as any;
    expect(op.summary).toBe('Export CSV');
    expect(op.operationId).toBe('exportCsv');
    expect(op.tags).toContain('export');
  });

  it('converts Hono :param syntax to OpenAPI {param} syntax', () => {
    const entries: RouteMetaEntry[] = [
      {
        path: '/items/:itemId/notes/:noteId',
        method: 'DELETE',
        meta: { summary: 'Delete note', operationId: 'deleteNote' },
      },
    ];

    const paths: Record<string, Record<string, unknown>> = {};
    buildManualPathItems(entries, paths, {});

    expect(paths['/items/{itemId}/notes/{noteId}']).toBeDefined();
  });

  it('attaches request body schema to components', () => {
    const entries: RouteMetaEntry[] = [
      {
        path: '/submit',
        method: 'POST',
        meta: {
          operationId: 'submitForm',
          request: { body: z.object({ name: z.string() }) },
          responses: { 201: { description: 'Created' } },
        },
      },
    ];

    const paths: Record<string, Record<string, unknown>> = {};
    const schemas: Record<string, Record<string, unknown>> = {};
    buildManualPathItems(entries, paths, schemas);

    expect(schemas['submitFormBody']).toBeDefined();
    const op = paths['/submit']!['post'] as any;
    expect(op.requestBody.content['application/json'].schema.$ref).toContain('submitFormBody');
  });
});

// ── generateOpenApiDocument ───────────────────────────────────────────────────

describe('generateOpenApiDocument', () => {
  it('produces a valid OpenAPI 3.1 document structure', () => {
    const model = makeModel();
    const doc = generateOpenApiDocument([model], [], { title: 'Test API', version: '2.0.0' });

    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('Test API');
    expect(doc.info.version).toBe('2.0.0');
    expect(doc.servers).toEqual([{ url: '/' }]);
    expect(doc.components.schemas).toBeDefined();
  });

  it('includes CRUD paths for models with crud: true', () => {
    const model = makeModel();
    const doc = generateOpenApiDocument([model], [], { title: 'T', version: '1' });

    expect(doc.paths['/users']).toBeDefined();
    expect(doc.paths['/users/{id}']).toBeDefined();
  });

  it('excludes models with crud: false', () => {
    const model = makeModel({ crud: false });
    const doc = generateOpenApiDocument([model], [], { title: 'T', version: '1' });

    expect(doc.paths['/users']).toBeUndefined();
  });

  it('includes hand-written route paths from routeMetas', () => {
    const model = makeModel();
    const routeMetas: RouteMetaEntry[] = [
      {
        path: '/export',
        method: 'GET',
        meta: { summary: 'Export', operationId: 'export' },
      },
    ];
    const doc = generateOpenApiDocument([model], routeMetas, { title: 'T', version: '1' });

    expect(doc.paths['/export']).toBeDefined();
  });

  it('uses default title/version when config is empty', () => {
    const doc = generateOpenApiDocument([], [], {});
    expect(doc.info.title).toBe('Web Loom API');
    expect(doc.info.version).toBe('1.0.0');
  });

  it('includes description in info when provided', () => {
    const doc = generateOpenApiDocument([], [], { title: 'T', version: '1', description: 'My API' });
    expect(doc.info.description).toBe('My API');
  });
});
