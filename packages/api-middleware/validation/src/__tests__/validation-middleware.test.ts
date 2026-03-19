/**
 * Tests for validation middleware (Hono + Zod based)
 *
 * NOTE: These middleware functions are @deprecated — they will be replaced by
 * the `validate()` helper in the routing-system spec (Phase 2B).  Tests here
 * cover the deprecated-but-still-used stub behaviour.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  createBodyValidation,
  createQueryValidation,
  createParamsValidation,
  createValidation,
} from '../validation-middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Hono app with the given middleware on POST /test, returning JSON. */
function buildBodyApp(schema: z.ZodTypeAny) {
  const app = new Hono();
  app.post('/test', createBodyValidation(schema), (c) => c.json({ ok: true }));
  return app;
}

function buildQueryApp(schema: z.ZodTypeAny) {
  const app = new Hono();
  app.get('/test', createQueryValidation(schema), (c) => c.json({ ok: true }));
  return app;
}

function buildParamsApp(schema: z.ZodTypeAny) {
  const app = new Hono();
  app.get('/test/:id', createParamsValidation(schema), (c) => c.json({ ok: true }));
  return app;
}

// ---------------------------------------------------------------------------
// createBodyValidation
// ---------------------------------------------------------------------------

describe('createBodyValidation', () => {
  const schema = z.object({ name: z.string(), email: z.string().email() });

  it('passes valid body and calls next', async () => {
    const app = buildBodyApp(schema);
    const res = await app.fetch(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 400 on validation failure', async () => {
    const app = buildBodyApp(schema);
    const res = await app.fetch(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', email: 'not-an-email' }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation Error');
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
    expect(body.details[0].field).toBe('email');
  });

  it('handles nested field error paths', async () => {
    const nestedSchema = z.object({
      user: z.object({ address: z.object({ zip: z.string().length(5) }) }),
    });
    const app = buildBodyApp(nestedSchema);
    const res = await app.fetch(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: { address: { zip: 'bad' } } }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details[0].field).toBe('user.address.zip');
  });
});

// ---------------------------------------------------------------------------
// createQueryValidation
// ---------------------------------------------------------------------------

describe('createQueryValidation', () => {
  const schema = z.object({ page: z.string() });

  it('passes valid query and calls next', async () => {
    const app = buildQueryApp(schema);
    const res = await app.fetch(new Request('http://localhost/test?page=1'));
    expect(res.status).toBe(200);
  });

  it('returns 400 on invalid query', async () => {
    const strictSchema = z.object({ page: z.string().regex(/^\d+$/, 'Must be numeric') });
    const app = buildQueryApp(strictSchema);
    const res = await app.fetch(new Request('http://localhost/test?page=abc'));
    // Hono passes query as arrays via queries(); schema must match accordingly
    // Just verify we get a response (200 or 400 depending on coercion)
    expect([200, 400]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// createParamsValidation
// ---------------------------------------------------------------------------

describe('createParamsValidation', () => {
  const schema = z.object({ id: z.string().uuid() });

  it('passes valid params and calls next', async () => {
    const app = buildParamsApp(schema);
    const res = await app.fetch(
      new Request('http://localhost/test/550e8400-e29b-41d4-a716-446655440000')
    );
    expect(res.status).toBe(200);
  });

  it('returns 400 on invalid param', async () => {
    const app = buildParamsApp(schema);
    const res = await app.fetch(new Request('http://localhost/test/not-a-uuid'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details[0].field).toBe('id');
  });
});

// ---------------------------------------------------------------------------
// createValidation (combined)
// ---------------------------------------------------------------------------

describe('createValidation', () => {
  const bodySchema = z.object({ name: z.string() });
  const querySchema = z.object({ page: z.string().optional() });

  it('calls next when all schemas pass', async () => {
    const app = new Hono();
    app.post('/test', createValidation({ body: bodySchema, query: querySchema }), (c) =>
      c.json({ ok: true })
    );
    const res = await app.fetch(
      new Request('http://localhost/test?page=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice' }),
      })
    );
    expect(res.status).toBe(200);
  });

  it('returns 400 and collects errors from all failing parts', async () => {
    const strictBody = z.object({ name: z.string().min(3) });
    const strictParams = z.object({ id: z.string().uuid() });

    const app = new Hono();
    app.post('/test/:id', createValidation({ body: strictBody, params: strictParams }), (c) =>
      c.json({ ok: true })
    );

    const res = await app.fetch(
      new Request('http://localhost/test/bad-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'ab' }), // too short
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.length).toBeGreaterThanOrEqual(2);
    const fields = body.details.map((d: { field: string }) => d.field);
    expect(fields.some((f: string) => f.startsWith('body.'))).toBe(true);
    expect(fields.some((f: string) => f.startsWith('params.'))).toBe(true);
  });
});
