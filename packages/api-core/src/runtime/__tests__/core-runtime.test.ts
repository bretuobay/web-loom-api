/**
 * Tests for createApp()
 *
 * These tests use a mock database to avoid requiring an actual DB driver.
 * DB-driver integration tests live in the integration test suite.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// ── Mock the DB initialisation so no real driver is needed ────────────────
vi.mock('../../db/create-drizzle-db', () => ({
  createDrizzleDb: vi.fn().mockResolvedValue({
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    $client: null,
  }),
}));

import { createApp } from '../core-runtime';
import type { WebLoomConfig } from '../../config/types';

const mockConfig: WebLoomConfig = {
  database: {
    url: 'libsql://localhost',
    driver: 'libsql',
  },
};

describe('createApp()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an Application object', async () => {
    const app = await createApp(mockConfig);

    expect(app).toBeDefined();
    expect(app.hono).toBeInstanceOf(Hono);
    expect(app.db).toBeDefined();
    expect(typeof app.start).toBe('function');
    expect(typeof app.handleRequest).toBe('function');
    expect(typeof app.shutdown).toBe('function');
    expect(typeof app.getModelRegistry).toBe('function');
    expect(typeof app.getRouteRegistry).toBe('function');
  });

  it('handles GET /health returning 200', async () => {
    const app = await createApp(mockConfig);
    const res = await app.handleRequest(new Request('http://localhost/health'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('handles GET /ready returning 200', async () => {
    const app = await createApp(mockConfig);
    const res = await app.handleRequest(new Request('http://localhost/ready'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ready');
  });

  it('returns model registry', async () => {
    const app = await createApp(mockConfig);
    const registry = app.getModelRegistry();

    expect(registry).toBeDefined();
    expect(typeof registry.getAll).toBe('function');
  });

  it('returns route registry', async () => {
    const app = await createApp(mockConfig);
    const registry = app.getRouteRegistry();

    expect(registry).toBeDefined();
    expect(typeof registry.getAll).toBe('function');
  });

  it('injects db into request context', async () => {
    const app = await createApp(mockConfig);

    app.hono.get('/test-db', (c) => {
      const db = c.var.db;
      return c.json({ hasDb: db != null });
    });

    const res = await app.handleRequest(new Request('http://localhost/test-db'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hasDb: boolean };
    expect(body.hasDb).toBe(true);
  });

  it('handleRequest delegates to hono.fetch', async () => {
    const app = await createApp(mockConfig);
    const spy = vi.spyOn(app.hono, 'fetch');

    await app.handleRequest(new Request('http://localhost/health'));

    expect(spy).toHaveBeenCalledOnce();
  });

  it('shutdown resolves without error when server was not started', async () => {
    const app = await createApp(mockConfig);
    await expect(app.shutdown(1000)).resolves.not.toThrow();
  });
});
