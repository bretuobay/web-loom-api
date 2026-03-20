import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

vi.mock('../db/create-drizzle-db', () => ({
  createDrizzleDb: vi.fn(async () => ({
    $client: {
      execute: vi.fn(async () => ({ rows: [{ '?column?': 1 }] })),
    },
  })),
}));

vi.mock('@web-loom/api-generator-crud', async () => {
  return import('../../../api-generators/crud/src/index.ts');
});

vi.mock('@web-loom/api-generator-openapi', async () => {
  return import('../../../api-generators/openapi/src/index.ts');
});

import { createApp } from './create-app';
import { defineConfig } from '../config/define-config';
import { defineModel } from '../models/define-model';
import { modelRegistry } from '../models/registry';

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
      })
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
