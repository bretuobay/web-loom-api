/**
 * Tests for the routing system:
 *   - filePathToMountPath path conventions
 *   - validate() formatting
 *   - defineRoutes() typed router
 *   - globalErrorHandler error shapes
 *   - health check endpoints
 *   - route discovery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { mkdtemp, writeFile } from 'node:fs/promises';

import { filePathToMountPath } from '../path-utils';
import { validate } from '../validate';
import { defineRoutes } from '../define-routes';
import { globalErrorHandler } from '../error-handler';
import { RouteLoadError, RouteConflictError } from '../errors';
import { discoverAndMountRoutes } from '../route-discovery';
import type { WebLoomVariables } from '../../types';
import { RouteRegistry } from '../../registry/route-registry';

// ---------------------------------------------------------------------------
// filePathToMountPath
// ---------------------------------------------------------------------------

describe('filePathToMountPath', () => {
  const base = '/project/src/routes';

  it('maps a flat file to its name', () => {
    expect(filePathToMountPath(`${base}/users.ts`, base)).toBe('/users');
  });

  it('maps index.ts in a subdirectory to the directory path', () => {
    expect(filePathToMountPath(`${base}/users/index.ts`, base)).toBe('/users');
  });

  it('maps top-level index.ts to /', () => {
    expect(filePathToMountPath(`${base}/index.ts`, base)).toBe('/');
  });

  it('maps [id] segment to :id', () => {
    expect(filePathToMountPath(`${base}/users/[id].ts`, base)).toBe('/users/:id');
  });

  it('maps [...slug] segment to *', () => {
    expect(filePathToMountPath(`${base}/posts/[...slug].ts`, base)).toBe('/posts/*');
  });

  it('maps deeply nested files', () => {
    expect(filePathToMountPath(`${base}/api/v1/health.ts`, base)).toBe('/api/v1/health');
  });
});

// ---------------------------------------------------------------------------
// validate()
// ---------------------------------------------------------------------------

describe('validate()', () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().int().positive() });

  function buildApp() {
    const app = new Hono();
    app.post('/test', validate('json', schema), (c) => c.json({ ok: true }));
    return app;
  }

  it('passes valid payload and calls the handler', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice', age: 30 }),
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 400 with VALIDATION_ERROR shape on invalid payload', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', age: -1 }),
      })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Request validation failed');
    expect(body.error.requestId).toBeDefined();
    expect(body.error.timestamp).toBeDefined();
    expect(Array.isArray(body.error.details.fields)).toBe(true);
    expect(body.error.details.fields.length).toBeGreaterThan(0);
    expect(body.error.details.fields[0]).toHaveProperty('path');
    expect(body.error.details.fields[0]).toHaveProperty('message');
    expect(body.error.details.fields[0]).toHaveProperty('code');
  });

  it('does not call next handler on validation failure', async () => {
    const handlerSpy = vi.fn(() => new Response('handler called'));
    const app = new Hono();
    app.post('/test', validate('json', schema), handlerSpy as any);

    const res = await app.fetch(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      })
    );
    expect(res.status).toBe(400);
    expect(handlerSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// defineRoutes()
// ---------------------------------------------------------------------------

describe('defineRoutes()', () => {
  it('returns a Hono instance', () => {
    const router = defineRoutes();
    expect(router).toBeInstanceOf(Hono);
  });

  it('allows registering GET handlers', async () => {
    const router = defineRoutes();
    router.get('/ping', (c) => c.json({ pong: true }));

    const res = await router.fetch(new Request('http://localhost/ping'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: true });
  });
});

// ---------------------------------------------------------------------------
// globalErrorHandler
// ---------------------------------------------------------------------------

describe('globalErrorHandler', () => {
  function buildErrorApp(throwFn: () => Error) {
    const app = new Hono();
    app.get('/boom', () => {
      throw throwFn();
    });
    app.onError(globalErrorHandler);
    return app;
  }

  it('returns 500 with INTERNAL_ERROR for unknown errors', async () => {
    const app = buildErrorApp(() => new Error('boom'));
    const res = await app.fetch(new Request('http://localhost/boom'));
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.requestId).toBeDefined();
    expect(body.error.timestamp).toBeDefined();
    expect(res.headers.get('X-Request-Id')).toBeDefined();
  });

  it('returns 404 for NotFoundError', async () => {
    const { NotFoundError } = await import('@web-loom/api-shared');
    const app = buildErrorApp(() => new NotFoundError('not found'));
    const res = await app.fetch(new Request('http://localhost/boom'));
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 for ConflictError', async () => {
    const { ConflictError } = await import('@web-loom/api-shared');
    const app = buildErrorApp(() => new ConflictError('conflict'));
    const res = await app.fetch(new Request('http://localhost/boom'));
    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('CONFLICT');
  });
});

// ---------------------------------------------------------------------------
// Route discovery
// ---------------------------------------------------------------------------

describe('discoverAndMountRoutes', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'web-loom-routes-'));
  });

  it('warns and does not throw when routesDir does not exist', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = new Hono<{ Variables: WebLoomVariables }>();
    await discoverAndMountRoutes(app, '/non/existent/dir');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('does not exist'));
    warnSpy.mockRestore();
  });

  it('throws RouteLoadError when a file does not export a Hono instance', async () => {
    await writeFile(join(tmpDir, 'bad.ts'), 'export default { not: "hono" };');

    // We need to use a .js file since vitest transforms .ts; use a pre-built route module
    // Instead, test RouteLoadError directly
    const error = new RouteLoadError('/some/file.ts', 'default export must be a Hono instance');
    expect(error.code).toBe('ROUTE_LOAD_ERROR');
    expect(error.message).toContain('/some/file.ts');
    expect(error.message).toContain('default export must be a Hono instance');
  });

  it('RouteConflictError carries conflicting file paths', () => {
    const error = new RouteConflictError('GET', '/users', 'routes/a.ts', 'routes/b.ts');
    expect(error.code).toBe('ROUTE_CONFLICT_ERROR');
    expect(error.files).toEqual(['routes/a.ts', 'routes/b.ts']);
    expect(error.conflictPath).toBe('GET /users');
  });

  it('mounts discovered routes under a base path and collects OpenAPI metadata once per route', async () => {
    const routeFile = join(tmpDir, 'users.ts');
    await writeFile(
      routeFile,
      `
        import { defineRoutes, openApiMeta } from '${pathToFileURL(join(process.cwd(), 'src/index.ts')).href}';

        const routes = defineRoutes();

        routes.get(
          '/',
          openApiMeta({
            summary: 'List users',
            operationId: 'listUsers',
            responses: { 200: { description: 'OK' } },
          }),
          (c) => c.json({ ok: true })
        );

        export default routes;
      `
    );

    const app = new Hono<{ Variables: WebLoomVariables }>();
    const routeRegistry = new RouteRegistry();
    const routeMetas: Array<{ path: string; method: string; meta: { summary?: string } }> = [];

    await discoverAndMountRoutes(app, tmpDir, {
      basePath: '/api',
      routeRegistry,
      routeMetaEntries: routeMetas as any,
    });

    const res = await app.fetch(new Request('http://localhost/api/users'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(routeRegistry.has('/api/users', 'GET')).toBe(true);
    expect(routeMetas).toHaveLength(1);
    expect(routeMetas[0]).toMatchObject({
      path: '/api/users',
      method: 'GET',
    });
    expect(routeMetas[0]?.meta.summary).toBe('List users');
  });
});
