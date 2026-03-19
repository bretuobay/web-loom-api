import { describe, expect, it } from 'vitest';
import { ClientGenerator } from '../index';

describe('ClientGenerator', () => {
  it('generates client artifacts for a simple route', () => {
    const generator = new ClientGenerator({
      className: 'TestClient',
      baseUrl: 'https://api.example.com',
      generateReactHooks: true,
      generateErrors: true,
    });

    generator.registerRoute({
      path: '/users/:id',
      method: 'GET',
      metadata: {
        description: 'Get user by id',
        tags: ['users'],
      },
    });

    const generated = generator.generate();

    expect(generated.client).toContain('class TestClient');
    expect(generated.client).toContain('async getUsersById');
    expect(generated.types).toContain('export interface APIResponse');
    expect(generated.utils).toContain('export function buildQueryString');
    expect(generated.errors).toContain('class APIError');
    expect(generated.hooks).toContain('useGetUsersById');
  });
});
