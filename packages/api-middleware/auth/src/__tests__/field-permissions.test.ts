import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fieldPermissions } from '../field-permissions';
import type { RequestContext } from '@web-loom/api-core';
import type { AuthenticatedUser, FieldPermissionConfig } from '../types';

function createCtx(user?: AuthenticatedUser): RequestContext {
  return {
    request: new Request('http://localhost/test'),
    params: {},
    query: {},
    body: {},
    user,
    metadata: new Map(),
  };
}

describe('fieldPermissions', () => {
  let next: ReturnType<typeof vi.fn>;

  const config: FieldPermissionConfig = {
    fields: {
      email: { readable: ['admin', 'user'] },
      ssn: { readable: ['admin'] },
      name: {}, // no restriction
    },
  };

  beforeEach(() => {
    next = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ name: 'John', email: 'john@example.com', ssn: '123-45-6789', age: 30 }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
  });

  it('should filter restricted fields for unauthorized users', async () => {
    const ctx = createCtx(); // no user
    const middleware = fieldPermissions(config);
    const response = await middleware(ctx, next);

    const body = await response.json();
    expect(body.name).toBe('John');
    expect(body.age).toBe(30); // no restriction
    expect(body.email).toBeUndefined(); // restricted
    expect(body.ssn).toBeUndefined(); // restricted
  });

  it('should allow fields for users with the right role', async () => {
    const user: AuthenticatedUser = { id: 'u1', email: 'a@b.com', role: 'admin' };
    const ctx = createCtx(user);
    const middleware = fieldPermissions(config);
    const response = await middleware(ctx, next);

    const body = await response.json();
    expect(body.name).toBe('John');
    expect(body.email).toBe('john@example.com');
    expect(body.ssn).toBe('123-45-6789');
  });

  it('should partially filter based on role', async () => {
    const user: AuthenticatedUser = { id: 'u1', email: 'a@b.com', role: 'user' };
    const ctx = createCtx(user);
    const middleware = fieldPermissions(config);
    const response = await middleware(ctx, next);

    const body = await response.json();
    expect(body.name).toBe('John');
    expect(body.email).toBe('john@example.com'); // user can read
    expect(body.ssn).toBeUndefined(); // only admin can read
  });

  it('should handle arrays of objects', async () => {
    next = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            { name: 'A', ssn: '111' },
            { name: 'B', ssn: '222' },
          ]),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const user: AuthenticatedUser = { id: 'u1', email: 'a@b.com', role: 'user' };
    const ctx = createCtx(user);
    const middleware = fieldPermissions(config);
    const response = await middleware(ctx, next);

    const body = await response.json();
    expect(body).toEqual([{ name: 'A' }, { name: 'B' }]);
  });

  it('should respect role hierarchy', async () => {
    const hierarchyConfig: FieldPermissionConfig = {
      fields: {
        secret: { readable: ['moderator'] },
      },
      hierarchy: { admin: ['moderator', 'user'] },
    };

    const user: AuthenticatedUser = { id: 'u1', email: 'a@b.com', role: 'admin' };
    next = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ secret: 'value' }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const ctx = createCtx(user);
    const middleware = fieldPermissions(hierarchyConfig);
    const response = await middleware(ctx, next);

    const body = await response.json();
    expect(body.secret).toBe('value'); // admin inherits moderator
  });

  it('should pass through non-JSON responses unchanged', async () => {
    next = vi.fn(() =>
      Promise.resolve(new Response('plain text', { headers: { 'Content-Type': 'text/plain' } })),
    );

    const ctx = createCtx();
    const middleware = fieldPermissions(config);
    const response = await middleware(ctx, next);

    expect(await response.text()).toBe('plain text');
  });
});
