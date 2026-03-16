import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireRoles, requirePermissions, resolveRoles } from '../rbac';
import type { RequestContext } from '@web-loom/api-core';
import type { AuthenticatedUser } from '../types';

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

describe('resolveRoles', () => {
  it('should return just the role when no hierarchy', () => {
    const roles = resolveRoles('admin', {});
    expect(roles).toEqual(new Set(['admin']));
  });

  it('should resolve inherited roles', () => {
    const hierarchy = { admin: ['moderator', 'user'], moderator: ['user'] };
    const roles = resolveRoles('admin', hierarchy);
    expect(roles).toEqual(new Set(['admin', 'moderator', 'user']));
  });

  it('should handle circular references gracefully', () => {
    const hierarchy = { a: ['b'], b: ['a'] };
    const roles = resolveRoles('a', hierarchy);
    expect(roles).toEqual(new Set(['a', 'b']));
  });
});

describe('requireRoles', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn(() => Promise.resolve(new Response('OK')));
  });

  it('should return 401 when no user is authenticated', async () => {
    const middleware = requireRoles('admin');
    const response = await middleware(createCtx(), next);

    expect(response.status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when user has no role', async () => {
    const user: AuthenticatedUser = { id: 'u1', email: 'a@b.com' };
    const middleware = requireRoles('admin');
    const response = await middleware(createCtx(user), next);

    expect(response.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when user role does not match', async () => {
    const user: AuthenticatedUser = { id: 'u1', email: 'a@b.com', role: 'user' };
    const middleware = requireRoles('admin');
    const response = await middleware(createCtx(user), next);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('INSUFFICIENT_PERMISSIONS');
    expect(next).not.toHaveBeenCalled();
  });

  it('should pass when user has the required role', async () => {
    const user: AuthenticatedUser = { id: 'u1', email: 'a@b.com', role: 'admin' };
    const middleware = requireRoles('admin');
    await middleware(createCtx(user), next);

    expect(next).toHaveBeenCalled();
  });

  it('should pass when user has any of the required roles', async () => {
    const user: AuthenticatedUser = { id: 'u1', email: 'a@b.com', role: 'moderator' };
    const middleware = requireRoles('admin', 'moderator');
    await middleware(createCtx(user), next);

    expect(next).toHaveBeenCalled();
  });

  it('should resolve hierarchical roles', async () => {
    const user: AuthenticatedUser = { id: 'u1', email: 'a@b.com', role: 'admin' };
    const hierarchy = { admin: ['moderator', 'user'] };
    const middleware = requireRoles('moderator', { hierarchy });
    await middleware(createCtx(user), next);

    expect(next).toHaveBeenCalled();
  });

  it('should reject when hierarchical role does not include required role', async () => {
    const user: AuthenticatedUser = { id: 'u1', email: 'a@b.com', role: 'user' };
    const hierarchy = { admin: ['moderator', 'user'] };
    const middleware = requireRoles('admin', { hierarchy });
    const response = await middleware(createCtx(user), next);

    expect(response.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requirePermissions', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn(() => Promise.resolve(new Response('OK')));
  });

  it('should return 401 when no user is authenticated', async () => {
    const middleware = requirePermissions('read:users');
    const response = await middleware(createCtx(), next);

    expect(response.status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when user has no scopes', async () => {
    const user: AuthenticatedUser = { id: 'u1', email: 'a@b.com' };
    const middleware = requirePermissions('read:users');
    const response = await middleware(createCtx(user), next);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.message).toContain('read:users');
    expect(next).not.toHaveBeenCalled();
  });

  it('should pass when user has all required permissions', async () => {
    const user: AuthenticatedUser = {
      id: 'u1',
      email: 'a@b.com',
      scopes: ['read:users', 'write:users'],
    };
    const middleware = requirePermissions('read:users', 'write:users');
    await middleware(createCtx(user), next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 403 when user is missing some permissions', async () => {
    const user: AuthenticatedUser = {
      id: 'u1',
      email: 'a@b.com',
      scopes: ['read:users'],
    };
    const middleware = requirePermissions('read:users', 'write:users');
    const response = await middleware(createCtx(user), next);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.message).toContain('write:users');
    expect(next).not.toHaveBeenCalled();
  });
});
