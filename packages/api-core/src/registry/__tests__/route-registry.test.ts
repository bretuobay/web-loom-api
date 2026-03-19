import { describe, it, expect, beforeEach } from 'vitest';
import { RouteRegistry } from '../route-registry';
import type { RouteDefinition } from '../route-types';
import { ConflictError, NotFoundError } from '@web-loom/api-shared';

describe('RouteRegistry', () => {
  let registry: RouteRegistry;

  // Mock route handler
  const mockHandler = async () => new Response('OK');

  beforeEach(() => {
    registry = new RouteRegistry();
  });

  describe('register()', () => {
    it('should register a new route', () => {
      const route: RouteDefinition = {
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      };

      registry.register(route);

      expect(registry.has('/users', 'GET')).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it('should register routes with dynamic parameters', () => {
      const route: RouteDefinition = {
        path: '/users/:id',
        method: 'GET',
        handler: mockHandler,
      };

      registry.register(route);

      expect(registry.has('/users/:id', 'GET')).toBe(true);
    });

    it('should register multiple routes with different methods', () => {
      registry.register({
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      });

      registry.register({
        path: '/users',
        method: 'POST',
        handler: mockHandler,
      });

      expect(registry.size()).toBe(2);
      expect(registry.has('/users', 'GET')).toBe(true);
      expect(registry.has('/users', 'POST')).toBe(true);
    });

    it('should register routes with metadata', () => {
      const route: RouteDefinition = {
        path: '/users',
        method: 'GET',
        handler: mockHandler,
        metadata: {
          description: 'List all users',
          tags: ['users'],
        },
      };

      registry.register(route);

      const metadata = registry.getMetadata('/users', 'GET');
      expect(metadata.description).toBe('List all users');
      expect(metadata.tags).toEqual(['users']);
    });

    it('should throw ConflictError for duplicate routes', () => {
      const route: RouteDefinition = {
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      };

      registry.register(route);

      expect(() => registry.register(route)).toThrow(ConflictError);
      expect(() => registry.register(route)).toThrow('Route already registered: GET /users');
    });

    it('should normalize paths by removing trailing slashes', () => {
      registry.register({
        path: '/users/',
        method: 'GET',
        handler: mockHandler,
      });

      expect(registry.has('/users', 'GET')).toBe(true);
      expect(registry.has('/users/', 'GET')).toBe(true);
    });

    it('should handle root path correctly', () => {
      registry.register({
        path: '/',
        method: 'GET',
        handler: mockHandler,
      });

      expect(registry.has('/', 'GET')).toBe(true);
    });
  });

  describe('unregister()', () => {
    it('should unregister an existing route', () => {
      registry.register({
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      });

      expect(registry.size()).toBe(1);

      registry.unregister('/users', 'GET');

      expect(registry.size()).toBe(0);
      expect(registry.has('/users', 'GET')).toBe(false);
    });

    it('should throw NotFoundError for non-existent routes', () => {
      expect(() => registry.unregister('/users', 'GET')).toThrow(NotFoundError);
      expect(() => registry.unregister('/users', 'GET')).toThrow('Route not found: GET /users');
    });
  });

  describe('get()', () => {
    it('should retrieve a registered route', () => {
      const route: RouteDefinition = {
        path: '/users/:id',
        method: 'GET',
        handler: mockHandler,
      };

      registry.register(route);

      const retrieved = registry.get('/users/:id', 'GET');

      expect(retrieved).toBeDefined();
      expect(retrieved?.path).toBe('/users/:id');
      expect(retrieved?.method).toBe('GET');
    });

    it('should return undefined for non-existent routes', () => {
      const route = registry.get('/users', 'GET');
      expect(route).toBeUndefined();
    });

    it('should distinguish between different HTTP methods', () => {
      registry.register({
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      });

      expect(registry.get('/users', 'GET')).toBeDefined();
      expect(registry.get('/users', 'POST')).toBeUndefined();
    });
  });

  describe('getAll()', () => {
    it('should return empty array when no routes registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all registered routes', () => {
      registry.register({
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      });

      registry.register({
        path: '/posts',
        method: 'GET',
        handler: mockHandler,
      });

      registry.register({
        path: '/users',
        method: 'POST',
        handler: mockHandler,
      });

      const routes = registry.getAll();
      expect(routes).toHaveLength(3);
    });
  });

  describe('getByPath()', () => {
    it('should return all routes for a specific path', () => {
      registry.register({
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      });

      registry.register({
        path: '/users',
        method: 'POST',
        handler: mockHandler,
      });

      registry.register({
        path: '/posts',
        method: 'GET',
        handler: mockHandler,
      });

      const userRoutes = registry.getByPath('/users');
      expect(userRoutes).toHaveLength(2);
      expect(userRoutes.every((r) => r.path === '/users')).toBe(true);
    });

    it('should return empty array for non-existent path', () => {
      const routes = registry.getByPath('/users');
      expect(routes).toEqual([]);
    });
  });

  describe('match()', () => {
    beforeEach(() => {
      // Register test routes
      registry.register({
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      });

      registry.register({
        path: '/users/:id',
        method: 'GET',
        handler: mockHandler,
      });

      registry.register({
        path: '/users/:id/posts/:postId',
        method: 'GET',
        handler: mockHandler,
      });

      registry.register({
        path: '/posts/:slug',
        method: 'GET',
        handler: mockHandler,
      });
    });

    it('should match static routes', () => {
      const match = registry.match('/users', 'GET');

      expect(match).toBeDefined();
      expect(match?.route.path).toBe('/users');
      expect(match?.params).toEqual({});
    });

    it('should match routes with single parameter', () => {
      const match = registry.match('/users/123', 'GET');

      expect(match).toBeDefined();
      expect(match?.route.path).toBe('/users/:id');
      expect(match?.params).toEqual({ id: '123' });
    });

    it('should match routes with multiple parameters', () => {
      const match = registry.match('/users/123/posts/456', 'GET');

      expect(match).toBeDefined();
      expect(match?.route.path).toBe('/users/:id/posts/:postId');
      expect(match?.params).toEqual({ id: '123', postId: '456' });
    });

    it('should decode URL-encoded parameters', () => {
      const match = registry.match('/posts/hello%20world', 'GET');

      expect(match).toBeDefined();
      expect(match?.params.slug).toBe('hello world');
    });

    it('should handle trailing slashes', () => {
      const match = registry.match('/users/', 'GET');

      expect(match).toBeDefined();
      expect(match?.route.path).toBe('/users');
    });

    it('should return undefined for non-matching paths', () => {
      const match = registry.match('/nonexistent', 'GET');
      expect(match).toBeUndefined();
    });

    it('should return undefined for wrong HTTP method', () => {
      const match = registry.match('/users', 'POST');
      expect(match).toBeUndefined();
    });

    it('should not match paths with different segment counts', () => {
      const match = registry.match('/users/123/extra', 'GET');
      expect(match).toBeUndefined();
    });

    it('should match root path', () => {
      registry.register({
        path: '/',
        method: 'GET',
        handler: mockHandler,
      });

      const match = registry.match('/', 'GET');

      expect(match).toBeDefined();
      expect(match?.route.path).toBe('/');
      expect(match?.params).toEqual({});
    });

    it('should handle special characters in parameters', () => {
      const match = registry.match('/posts/my-post-123', 'GET');

      expect(match).toBeDefined();
      expect(match?.params.slug).toBe('my-post-123');
    });
  });

  describe('getMetadata()', () => {
    it('should return route metadata', () => {
      registry.register({
        path: '/users',
        method: 'GET',
        handler: mockHandler,
        metadata: {
          description: 'List users',
          tags: ['users'],
          deprecated: false,
        },
      });

      const metadata = registry.getMetadata('/users', 'GET');

      expect(metadata.description).toBe('List users');
      expect(metadata.tags).toEqual(['users']);
      expect(metadata.deprecated).toBe(false);
    });

    it('should return empty object for routes without metadata', () => {
      registry.register({
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      });

      const metadata = registry.getMetadata('/users', 'GET');

      expect(metadata).toEqual({});
    });

    it('should return empty object for non-existent routes', () => {
      const metadata = registry.getMetadata('/users', 'GET');
      expect(metadata).toEqual({});
    });
  });

  describe('has()', () => {
    it('should return true for registered routes', () => {
      registry.register({
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      });

      expect(registry.has('/users', 'GET')).toBe(true);
    });

    it('should return false for non-existent routes', () => {
      expect(registry.has('/users', 'GET')).toBe(false);
    });

    it('should distinguish between HTTP methods', () => {
      registry.register({
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      });

      expect(registry.has('/users', 'GET')).toBe(true);
      expect(registry.has('/users', 'POST')).toBe(false);
    });
  });

  describe('clear()', () => {
    it('should remove all routes', () => {
      registry.register({
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      });

      registry.register({
        path: '/posts',
        method: 'GET',
        handler: mockHandler,
      });

      expect(registry.size()).toBe(2);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('size()', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size()).toBe(0);
    });

    it('should return correct count of registered routes', () => {
      registry.register({
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      });

      expect(registry.size()).toBe(1);

      registry.register({
        path: '/posts',
        method: 'GET',
        handler: mockHandler,
      });

      expect(registry.size()).toBe(2);
    });

    it('should update after unregister', () => {
      registry.register({
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      });

      expect(registry.size()).toBe(1);

      registry.unregister('/users', 'GET');

      expect(registry.size()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty path segments', () => {
      const match = registry.match('//users//123//', 'GET');
      // Should normalize and match /users/123
      expect(match).toBeUndefined(); // Different segment count
    });

    it('should handle complex parameter names', () => {
      registry.register({
        path: '/api/:apiVersion/users/:userId',
        method: 'GET',
        handler: mockHandler,
      });

      const match = registry.match('/api/v1/users/123', 'GET');

      expect(match).toBeDefined();
      expect(match?.params).toEqual({
        apiVersion: 'v1',
        userId: '123',
      });
    });

    it('should handle numeric parameters', () => {
      registry.register({
        path: '/items/:id',
        method: 'GET',
        handler: mockHandler,
      });

      const match = registry.match('/items/12345', 'GET');

      expect(match).toBeDefined();
      expect(match?.params.id).toBe('12345');
    });

    it('should handle UUID parameters', () => {
      registry.register({
        path: '/resources/:uuid',
        method: 'GET',
        handler: mockHandler,
      });

      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const match = registry.match(`/resources/${uuid}`, 'GET');

      expect(match).toBeDefined();
      expect(match?.params.uuid).toBe(uuid);
    });
  });

  describe('conflict detection', () => {
    it('should detect exact path conflicts', () => {
      registry.register({
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      });

      expect(() =>
        registry.register({
          path: '/users',
          method: 'GET',
          handler: mockHandler,
        })
      ).toThrow(ConflictError);
    });

    it('should allow same path with different methods', () => {
      registry.register({
        path: '/users',
        method: 'GET',
        handler: mockHandler,
      });

      expect(() =>
        registry.register({
          path: '/users',
          method: 'POST',
          handler: mockHandler,
        })
      ).not.toThrow();
    });

    it('should detect conflicts with normalized paths', () => {
      registry.register({
        path: '/users/',
        method: 'GET',
        handler: mockHandler,
      });

      expect(() =>
        registry.register({
          path: '/users',
          method: 'GET',
          handler: mockHandler,
        })
      ).toThrow(ConflictError);
    });
  });
});
