import { describe, expect, it } from 'vitest';
import { OpenAPIGenerator, type ModelDefinition } from '../index';
import type { RouteDefinition } from '@web-loom/api-core';

const createRoute = (): RouteDefinition => ({
  path: '/users/:id',
  method: 'GET',
  handler: () => new Response(JSON.stringify({ id: '123' }), { status: 200 }),
  metadata: {
    description: 'Get user by id',
    tags: ['users'],
  },
});

const createModel = (): ModelDefinition => ({
  name: 'User',
  fields: [
    { name: 'id', type: 'uuid' },
    { name: 'email', type: 'string' },
  ],
  metadata: {
    description: 'User record',
  },
});

describe('OpenAPIGenerator', () => {
  it('generates a basic OpenAPI document from registered models and routes', () => {
    const generator = new OpenAPIGenerator({
      title: 'Test API',
      version: '1.0.0',
    });

    generator.registerModel(createModel());
    generator.registerRoute(createRoute());

    const spec = generator.generate();

    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('Test API');
    expect(spec.paths['/users/{id}']?.get?.summary).toContain('Get user by id');
    expect(spec.paths['/users/{id}']?.get?.tags).toContain('users');
    expect(spec.components?.schemas?.User).toBeDefined();
    expect(generator.toJSON(false)).toContain('"openapi":"3.1.0"');
  });
});
