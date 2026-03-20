import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { Hono } from 'hono';

vi.mock('../db/create-drizzle-db', () => ({
  createDrizzleDb: vi.fn(async () => ({
    $client: {
      execute: vi.fn(async () => ({ rows: [{ '?column?': 1 }] })),
    },
  })),
}));

import { createApp } from './create-app';
import { defineConfig } from '../config/define-config';
import { defineModel } from '../models/define-model';
import { modelRegistry } from '../models/registry';
import type { AnyModel, WebLoomVariables } from '../index';

function testCrudGenerator(_model: AnyModel): Hono<{ Variables: WebLoomVariables }> {
  const router = new Hono<{ Variables: WebLoomVariables }>();
  router.get('/', (c) => c.json({ data: [] }));
  router.get('/:id', (c) => c.json({ data: { id: c.req.param('id') } }));
  return router;
}

async function testOpenApiSetup(
  app: Hono<{ Variables: WebLoomVariables }>,
  models: AnyModel[]
): Promise<void> {
  const paths = Object.fromEntries(
    models.flatMap((model) => [
      [`/api${model.meta.basePath}`, { get: { summary: `List ${model.meta.name}` } }],
      [`/api${model.meta.basePath}/{id}`, { get: { summary: `Read ${model.meta.name}` } }],
    ])
  );

  app.get('/openapi.json', (c) => c.json({ openapi: '3.1.0', paths }));
}

describe('createApp()', () => {
  beforeEach(() => {
    modelRegistry.clear();
  });

  afterEach(() => {
    modelRegistry.clear();
  });

  it('auto-wires CRUD and OpenAPI routes into the default /api golden path', async () => {
    const usersTable = pgTable('users', {
      id: uuid('id').defaultRandom().primaryKey(),
      name: text('name').notNull(),
    });

    defineModel(usersTable, {
      name: 'User',
      basePath: '/users',
      crud: true,
    });

    const app = await createApp(
      defineConfig({
        database: {
          url: 'postgresql://example.com/test',
          driver: 'neon-serverless',
        },
        features: { crud: true },
        openapi: {
          enabled: true,
          title: 'Test API',
          version: '1.0.0',
        },
      }),
      {
        crudGenerator: testCrudGenerator,
        openapiSetup: testOpenApiSetup,
      }
    );

    const openApiRes = await app.handleRequest(new Request('http://localhost/openapi.json'));
    expect(openApiRes.status).toBe(200);

    const openApiDoc = (await openApiRes.json()) as {
      paths: Record<string, unknown>;
    };
    expect(openApiDoc.paths['/api/users']).toBeDefined();
    expect(openApiDoc.paths['/api/users/{id}']).toBeDefined();

    expect(app.getRouteRegistry().has('/api/users', 'GET')).toBe(true);
    expect(app.getRouteRegistry().has('/api/users/:id', 'GET')).toBe(true);
  });
});
