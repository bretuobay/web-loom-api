import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { Hono } from 'hono';
import { modelRegistry, defineModel } from '@web-loom/api-core';
import { generateCrudRouter } from '../generate-crud-router';
import type { WebLoomVariables } from '@web-loom/api-core';

// ─── Schema definitions ──────────────────────────────────────────────────────

const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  status: text('status').default('draft'),
  age: integer('age'),
});

const timestampedPosts = sqliteTable('timestamped_posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

const softPosts = sqliteTable('soft_posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// ─── DB factory ──────────────────────────────────────────────────────────────

async function createTestDb() {
  const client = createClient({ url: ':memory:' });
  await client.execute(`CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    age INTEGER
  )`);
  await client.execute(`CREATE TABLE timestamped_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at INTEGER,
    updated_at INTEGER
  )`);
  await client.execute(`CREATE TABLE soft_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    deleted_at INTEGER
  )`);
  return drizzle(client);
}

// ─── App factory ─────────────────────────────────────────────────────────────

function buildApp(db: any, router: Hono<any>, basePath: string) {
  const app = new Hono<{ Variables: WebLoomVariables }>();
  app.use('*', (c, next) => {
    c.set('db', db);
    return next();
  });
  app.route(basePath, router);
  return app;
}

function jsonBody(data: unknown) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

function patchBody(data: unknown) {
  return {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

function putBody(data: unknown) {
  return {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CRUD Generator — posts', () => {
  let db: any;
  let app: Hono<any>;

  beforeEach(async () => {
    modelRegistry.clear();
    db = await createTestDb();
    const postModel = defineModel(posts, { name: 'Post', crud: true });
    const router = generateCrudRouter(postModel);
    app = buildApp(db, router, '/posts');
  });

  // ── Create ──────────────────────────────────────────────────────────────────

  it('POST / creates a record and returns 201', async () => {
    const res = await app.request(
      '/posts',
      jsonBody({ title: 'Hello World', status: 'published' })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.title).toBe('Hello World');
  });

  it('POST / returns 400 when required fields missing', async () => {
    const res = await app.request('/posts', jsonBody({ status: 'draft' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // ── List ────────────────────────────────────────────────────────────────────

  it('GET / returns paginated list', async () => {
    await app.request('/posts', jsonBody({ title: 'Post 1' }));
    await app.request('/posts', jsonBody({ title: 'Post 2' }));

    const res = await app.request('/posts');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
    expect(body.pagination.page).toBe(1);
  });

  it('GET / respects page and limit params', async () => {
    for (let i = 1; i <= 5; i++) {
      await app.request('/posts', jsonBody({ title: `Post ${i}` }));
    }
    const res = await app.request('/posts?page=2&limit=2');
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.limit).toBe(2);
    expect(body.pagination.total).toBe(5);
    expect(body.pagination.totalPages).toBe(3);
    expect(body.pagination.hasNext).toBe(true);
    expect(body.pagination.hasPrev).toBe(true);
  });

  it('GET / filters by equality', async () => {
    await app.request('/posts', jsonBody({ title: 'Draft Post', status: 'draft' }));
    await app.request('/posts', jsonBody({ title: 'Published Post', status: 'published' }));

    const res = await app.request('/posts?status=published');
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Published Post');
  });

  it('GET / filters with [gte] operator', async () => {
    await app.request('/posts', jsonBody({ title: 'Young', age: 10 }));
    await app.request('/posts', jsonBody({ title: 'Old', age: 30 }));

    const res = await app.request('/posts?age[gte]=25');
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Old');
  });

  it('GET / filters with [lte] operator', async () => {
    await app.request('/posts', jsonBody({ title: 'Young', age: 10 }));
    await app.request('/posts', jsonBody({ title: 'Old', age: 30 }));

    const res = await app.request('/posts?age[lte]=15');
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Young');
  });

  it('GET / filters with [like] operator', async () => {
    await app.request('/posts', jsonBody({ title: 'Alpha' }));
    await app.request('/posts', jsonBody({ title: 'Beta' }));

    const res = await app.request('/posts?title[like]=Al%25');
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Alpha');
  });

  it('GET / filters with [in] operator', async () => {
    await app.request('/posts', jsonBody({ title: 'P1', status: 'draft' }));
    await app.request('/posts', jsonBody({ title: 'P2', status: 'published' }));
    await app.request('/posts', jsonBody({ title: 'P3', status: 'archived' }));

    const res = await app.request('/posts?status[in]=draft,published');
    const body = await res.json();
    expect(body.data).toHaveLength(2);
  });

  it('GET / sorts ascending', async () => {
    await app.request('/posts', jsonBody({ title: 'B Post' }));
    await app.request('/posts', jsonBody({ title: 'A Post' }));

    const res = await app.request('/posts?sort=title');
    const body = await res.json();
    expect(body.data[0].title).toBe('A Post');
  });

  it('GET / sorts descending with - prefix', async () => {
    await app.request('/posts', jsonBody({ title: 'A Post' }));
    await app.request('/posts', jsonBody({ title: 'B Post' }));

    const res = await app.request('/posts?sort=-title');
    const body = await res.json();
    expect(body.data[0].title).toBe('B Post');
  });

  it('GET / returns 400 for invalid sort field', async () => {
    const res = await app.request('/posts?sort=nonExistentField');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_SORT_FIELD');
  });

  // ── Read ────────────────────────────────────────────────────────────────────

  it('GET /:id returns record by id', async () => {
    const createRes = await app.request('/posts', jsonBody({ title: 'My Post' }));
    const created = await createRes.json();

    const res = await app.request(`/posts/${created.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('My Post');
  });

  it('GET /:id returns 404 when not found', async () => {
    const res = await app.request('/posts/9999');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('GET /:id returns 400 for invalid id type', async () => {
    const res = await app.request('/posts/not-a-number');
    expect(res.status).toBe(400);
  });

  // ── Replace ─────────────────────────────────────────────────────────────────

  it('PUT /:id replaces the record', async () => {
    const createRes = await app.request('/posts', jsonBody({ title: 'Original' }));
    const created = await createRes.json();

    const res = await app.request(`/posts/${created.id}`, putBody({ title: 'Updated' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Updated');
  });

  it('PUT /:id returns 404 when not found', async () => {
    const res = await app.request('/posts/9999', putBody({ title: 'Updated' }));
    expect(res.status).toBe(404);
  });

  // ── Patch ───────────────────────────────────────────────────────────────────

  it('PATCH /:id updates only provided fields', async () => {
    const createRes = await app.request('/posts', jsonBody({ title: 'Original', status: 'draft' }));
    const created = await createRes.json();

    const res = await app.request(`/posts/${created.id}`, patchBody({ status: 'published' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Original');
    expect(body.status).toBe('published');
  });

  it('PATCH /:id returns 400 for empty body', async () => {
    const createRes = await app.request('/posts', jsonBody({ title: 'Test' }));
    const created = await createRes.json();

    const res = await app.request(`/posts/${created.id}`, patchBody({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH /:id returns 404 when not found', async () => {
    const res = await app.request('/posts/9999', patchBody({ title: 'New' }));
    expect(res.status).toBe(404);
  });

  // ── Delete ──────────────────────────────────────────────────────────────────

  it('DELETE /:id hard deletes the record and returns 204', async () => {
    const createRes = await app.request('/posts', jsonBody({ title: 'Delete Me' }));
    const created = await createRes.json();

    const deleteRes = await app.request(`/posts/${created.id}`, { method: 'DELETE' });
    expect(deleteRes.status).toBe(204);

    const readRes = await app.request(`/posts/${created.id}`);
    expect(readRes.status).toBe(404);
  });

  it('DELETE /:id returns 404 when not found', async () => {
    const res = await app.request('/posts/9999', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

// ─── Timestamps ──────────────────────────────────────────────────────────────

describe('CRUD Generator — timestamps', () => {
  let db: any;
  let app: Hono<any>;

  beforeEach(async () => {
    modelRegistry.clear();
    db = await createTestDb();
    const model = defineModel(timestampedPosts, {
      name: 'TimestampedPost',
      crud: { timestamps: true },
    });
    const router = generateCrudRouter(model);
    app = buildApp(db, router, '/tposts');
  });

  it('POST / auto-sets createdAt and updatedAt', async () => {
    const res = await app.request('/tposts', jsonBody({ title: 'TS Post' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  it('PATCH /:id updates updatedAt', async () => {
    const createRes = await app.request('/tposts', jsonBody({ title: 'TS Post' }));
    const created = await createRes.json();

    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));

    const patchRes = await app.request(`/tposts/${created.id}`, patchBody({ title: 'Updated' }));
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.updatedAt).toBeDefined();
  });
});

// ─── Soft delete ──────────────────────────────────────────────────────────────

describe('CRUD Generator — soft delete', () => {
  let db: any;
  let app: Hono<any>;

  beforeEach(async () => {
    modelRegistry.clear();
    db = await createTestDb();
    const model = defineModel(softPosts, {
      name: 'SoftPost',
      crud: { softDelete: true },
    });
    const router = generateCrudRouter(model);
    app = buildApp(db, router, '/sposts');
  });

  it('DELETE /:id sets deletedAt instead of hard-deleting', async () => {
    const createRes = await app.request('/sposts', jsonBody({ title: 'Soft Delete Me' }));
    const created = await createRes.json();

    const deleteRes = await app.request(`/sposts/${created.id}`, { method: 'DELETE' });
    expect(deleteRes.status).toBe(204);
  });

  it('GET / excludes soft-deleted records', async () => {
    const createRes = await app.request('/sposts', jsonBody({ title: 'To Delete' }));
    const created = await createRes.json();

    await app.request(`/sposts/${created.id}`, { method: 'DELETE' });

    const listRes = await app.request('/sposts');
    const body = await listRes.json();
    expect(body.data).toHaveLength(0);
  });

  it('GET /:id returns 404 for soft-deleted records', async () => {
    const createRes = await app.request('/sposts', jsonBody({ title: 'Ghost' }));
    const created = await createRes.json();

    await app.request(`/sposts/${created.id}`, { method: 'DELETE' });

    const readRes = await app.request(`/sposts/${created.id}`);
    expect(readRes.status).toBe(404);
  });
});

// ─── Auth ────────────────────────────────────────────────────────────────────

describe('CRUD Generator — auth', () => {
  let db: any;

  beforeEach(async () => {
    modelRegistry.clear();
    db = await createTestDb();
  });

  it('returns 401 when auth: true and no user is set', async () => {
    const model = defineModel(posts, {
      name: 'Post',
      crud: { list: { auth: true }, read: { auth: true }, create: { auth: true } },
    });
    const router = generateCrudRouter(model);
    const app = buildApp(db, router, '/posts');

    const res = await app.request('/posts');
    expect(res.status).toBe(401);
  });

  it('passes through when auth: true and user is set', async () => {
    const model = defineModel(posts, {
      name: 'Post',
      crud: { list: { auth: true } },
    });
    const router = generateCrudRouter(model);
    const app = new Hono<{ Variables: WebLoomVariables }>();
    app.use('*', (c, next) => {
      c.set('db', db);
      c.set('user', { id: 'u1', role: 'user' });
      return next();
    });
    app.route('/posts', router);

    const res = await app.request('/posts');
    expect(res.status).toBe(200);
  });

  it('returns 403 when role does not match', async () => {
    const model = defineModel(posts, {
      name: 'Post',
      crud: { create: { auth: 'admin' } },
    });
    const router = generateCrudRouter(model);
    const app = new Hono<{ Variables: WebLoomVariables }>();
    app.use('*', (c, next) => {
      c.set('db', db);
      c.set('user', { id: 'u1', role: 'user' });
      return next();
    });
    app.route('/posts', router);

    const res = await app.request('/posts', jsonBody({ title: 'Forbidden' }));
    expect(res.status).toBe(403);
  });

  it('passes through when role matches', async () => {
    const model = defineModel(posts, {
      name: 'Post',
      crud: { create: { auth: 'admin' } },
    });
    const router = generateCrudRouter(model);
    const app = new Hono<{ Variables: WebLoomVariables }>();
    app.use('*', (c, next) => {
      c.set('db', db);
      c.set('user', { id: 'u1', role: 'admin' });
      return next();
    });
    app.route('/posts', router);

    const res = await app.request('/posts', jsonBody({ title: 'Allowed' }));
    expect(res.status).toBe(201);
  });
});
