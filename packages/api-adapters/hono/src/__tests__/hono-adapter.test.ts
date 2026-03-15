import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HonoAdapter } from '../hono-adapter';
import type { RequestContext } from '@web-loom/api-core';

describe('HonoAdapter', () => {
  let adapter: HonoAdapter;

  beforeEach(() => {
    adapter = new HonoAdapter();
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('Route Registration', () => {
    it('should register a GET route', async () => {
      adapter.registerRoute('GET', '/test', async (ctx) => {
        return new Response(JSON.stringify({ message: 'GET test' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const request = new Request('http://localhost/test', { method: 'GET' });
      const response = await adapter.handleRequest(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: 'GET test' });
    });

    it('should register a POST route', async () => {
      adapter.registerRoute('POST', '/test', async (ctx) => {
        return new Response(JSON.stringify({ message: 'POST test', body: ctx.body }), {
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const request = new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      });
      const response = await adapter.handleRequest(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: 'POST test', body: { name: 'test' } });
    });

    it('should register a PUT route', async () => {
      adapter.registerRoute('PUT', '/test/:id', async (ctx) => {
        return new Response(
          JSON.stringify({ message: 'PUT test', id: ctx.params.id, body: ctx.body }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      });

      const request = new Request('http://localhost/test/123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'updated' }),
      });
      const response = await adapter.handleRequest(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: 'PUT test', id: '123', body: { name: 'updated' } });
    });

    it('should register a PATCH route', async () => {
      adapter.registerRoute('PATCH', '/test/:id', async (ctx) => {
        return new Response(
          JSON.stringify({ message: 'PATCH test', id: ctx.params.id }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      });

      const request = new Request('http://localhost/test/456', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      const response = await adapter.handleRequest(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: 'PATCH test', id: '456' });
    });

    it('should register a DELETE route', async () => {
      adapter.registerRoute('DELETE', '/test/:id', async (ctx) => {
        return new Response(
          JSON.stringify({ message: 'DELETE test', id: ctx.params.id }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      });

      const request = new Request('http://localhost/test/789', { method: 'DELETE' });
      const response = await adapter.handleRequest(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: 'DELETE test', id: '789' });
    });

    it('should register an OPTIONS route', async () => {
      adapter.registerRoute('OPTIONS', '/test', async (ctx) => {
        return new Response(null, {
          status: 204,
          headers: { 'Allow': 'GET, POST, OPTIONS' },
        });
      });

      const request = new Request('http://localhost/test', { method: 'OPTIONS' });
      const response = await adapter.handleRequest(request);

      expect(response.status).toBe(204);
      expect(response.headers.get('Allow')).toBe('GET, POST, OPTIONS');
    });

    it('should register a HEAD route', async () => {
      adapter.registerRoute('HEAD', '/test', async (ctx) => {
        return new Response(null, {
          status: 200,
          headers: { 'Content-Length': '42' },
        });
      });

      const request = new Request('http://localhost/test', { method: 'HEAD' });
      const response = await adapter.handleRequest(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Length')).toBe('42');
    });
  });

  describe('Path Parameters', () => {
    it('should extract single path parameter', async () => {
      adapter.registerRoute('GET', '/users/:id', async (ctx) => {
        return new Response(JSON.stringify({ id: ctx.params.id }), {
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const request = new Request('http://localhost/users/123', { method: 'GET' });
      const response = await adapter.handleRequest(request);
      const data = await response.json();

      expect(data).toEqual({ id: '123' });
    });

    it('should extract multiple path parameters', async () => {
      adapter.registerRoute('GET', '/users/:userId/posts/:postId', async (ctx) => {
        return new Response(
          JSON.stringify({ userId: ctx.params.userId, postId: ctx.params.postId }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      });

      const request = new Request('http://localhost/users/123/posts/456', { method: 'GET' });
      const response = await adapter.handleRequest(request);
      const data = await response.json();

      expect(data).toEqual({ userId: '123', postId: '456' });
    });
  });

  describe('Query Parameters', () => {
    it('should extract single query parameter', async () => {
      adapter.registerRoute('GET', '/search', async (ctx) => {
        return new Response(JSON.stringify({ query: ctx.query }), {
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const request = new Request('http://localhost/search?q=test', { method: 'GET' });
      const response = await adapter.handleRequest(request);
      const data = await response.json();

      expect(data).toEqual({ query: { q: 'test' } });
    });

    it('should extract multiple query parameters', async () => {
      adapter.registerRoute('GET', '/search', async (ctx) => {
        return new Response(JSON.stringify({ query: ctx.query }), {
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const request = new Request('http://localhost/search?q=test&page=2&limit=10', {
        method: 'GET',
      });
      const response = await adapter.handleRequest(request);
      const data = await response.json();

      expect(data).toEqual({ query: { q: 'test', page: '2', limit: '10' } });
    });
  });

  describe('Request Body Parsing', () => {
    it('should parse JSON request body', async () => {
      adapter.registerRoute('POST', '/data', async (ctx) => {
        return new Response(JSON.stringify({ received: ctx.body }), {
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const request = new Request('http://localhost/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test', value: 42 }),
      });
      const response = await adapter.handleRequest(request);
      const data = await response.json();

      expect(data).toEqual({ received: { name: 'test', value: 42 } });
    });

    it('should handle invalid JSON gracefully', async () => {
      adapter.registerRoute('POST', '/data', async (ctx) => {
        return new Response(
          JSON.stringify({ received: ctx.body, bodyType: typeof ctx.body }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      });

      const request = new Request('http://localhost/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json{',
      });
      const response = await adapter.handleRequest(request);
      const data = await response.json();

      expect(data.received).toBeUndefined();
    });

    it('should parse form-urlencoded request body', async () => {
      adapter.registerRoute('POST', '/form', async (ctx) => {
        return new Response(JSON.stringify({ received: ctx.body }), {
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const formData = new URLSearchParams();
      formData.append('name', 'test');
      formData.append('email', 'test@example.com');

      const request = new Request('http://localhost/form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
      const response = await adapter.handleRequest(request);
      const data = await response.json();

      expect(data.received).toEqual({ name: 'test', email: 'test@example.com' });
    });
  });

  describe('Middleware', () => {
    it('should execute global middleware', async () => {
      const executionOrder: string[] = [];

      adapter.registerMiddleware(async (ctx, next) => {
        executionOrder.push('middleware-before');
        const response = await next();
        executionOrder.push('middleware-after');
        return response;
      });

      adapter.registerRoute('GET', '/test', async (ctx) => {
        executionOrder.push('handler');
        return new Response(JSON.stringify({ order: executionOrder }), {
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const request = new Request('http://localhost/test', { method: 'GET' });
      await adapter.handleRequest(request);

      expect(executionOrder).toEqual(['middleware-before', 'handler', 'middleware-after']);
    });

    it('should execute scoped middleware on matching path', async () => {
      const executionOrder: string[] = [];

      adapter.registerMiddleware(
        async (ctx, next) => {
          executionOrder.push('scoped-middleware');
          return await next();
        },
        { path: '/admin/*' }
      );

      adapter.registerRoute('GET', '/admin/users', async (ctx) => {
        executionOrder.push('handler');
        return new Response(JSON.stringify({ order: executionOrder }), {
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const request = new Request('http://localhost/admin/users', { method: 'GET' });
      await adapter.handleRequest(request);

      expect(executionOrder).toContain('scoped-middleware');
      expect(executionOrder).toContain('handler');
    });

    it('should allow middleware to modify context', async () => {
      adapter.registerMiddleware(async (ctx, next) => {
        ctx.metadata.set('userId', '123');
        return await next();
      });

      adapter.registerRoute('GET', '/test', async (ctx) => {
        return new Response(
          JSON.stringify({ userId: ctx.metadata.get('userId') }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      });

      const request = new Request('http://localhost/test', { method: 'GET' });
      const response = await adapter.handleRequest(request);
      const data = await response.json();

      expect(data).toEqual({ userId: '123' });
    });

    it('should allow middleware to return early response', async () => {
      adapter.registerMiddleware(async (ctx, next) => {
        if (ctx.request.headers.get('Authorization') !== 'Bearer token') {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return await next();
      });

      adapter.registerRoute('GET', '/protected', async (ctx) => {
        return new Response(JSON.stringify({ message: 'Protected data' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const request = new Request('http://localhost/protected', { method: 'GET' });
      const response = await adapter.handleRequest(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('Server Lifecycle', () => {
    it('should start server on specified port', async () => {
      const port = 3001 + Math.floor(Math.random() * 1000);
      const testAdapter = new HonoAdapter();
      
      try {
        await testAdapter.listen(port);

        // Make a real HTTP request to verify server is listening
        const response = await fetch(`http://localhost:${port}/`);
        expect(response.status).toBe(404); // No route registered for /
      } finally {
        await testAdapter.close();
      }
    });

    it('should close server gracefully', async () => {
      const port = 4001 + Math.floor(Math.random() * 1000);
      const testAdapter = new HonoAdapter();
      
      await testAdapter.listen(port);
      await testAdapter.close();

      // Server should be closed, request should fail
      await expect(fetch(`http://localhost:${port}/`)).rejects.toThrow();
    });

    it('should handle multiple close calls gracefully', async () => {
      await adapter.close();
      await adapter.close(); // Should not throw
    });
  });

  describe('Request Context', () => {
    it('should provide complete request context to handler', async () => {
      let capturedContext: RequestContext | null = null;

      adapter.registerRoute('POST', '/users/:id', async (ctx) => {
        capturedContext = ctx;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const request = new Request('http://localhost/users/123?page=1&limit=10', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      });

      await adapter.handleRequest(request);

      expect(capturedContext).not.toBeNull();
      expect(capturedContext!.params).toEqual({ id: '123' });
      expect(capturedContext!.query).toEqual({ page: '1', limit: '10' });
      expect(capturedContext!.body).toEqual({ name: 'test' });
      expect(capturedContext!.request).toBeInstanceOf(Request);
      expect(capturedContext!.metadata).toBeInstanceOf(Map);
    });

    it('should initialize user and session as undefined', async () => {
      let capturedContext: RequestContext | null = null;

      adapter.registerRoute('GET', '/test', async (ctx) => {
        capturedContext = ctx;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const request = new Request('http://localhost/test', { method: 'GET' });
      await adapter.handleRequest(request);

      expect(capturedContext!.user).toBeUndefined();
      expect(capturedContext!.session).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should propagate handler errors', async () => {
      adapter.registerRoute('GET', '/error', async (ctx) => {
        throw new Error('Test error');
      });

      const request = new Request('http://localhost/error', { method: 'GET' });
      const response = await adapter.handleRequest(request);

      expect(response.status).toBe(500);
    });

    it('should handle async handler errors', async () => {
      adapter.registerRoute('GET', '/async-error', async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('Async test error');
      });

      const request = new Request('http://localhost/async-error', { method: 'GET' });
      const response = await adapter.handleRequest(request);

      expect(response.status).toBe(500);
    });
  });
});
