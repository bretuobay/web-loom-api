import { describe, it, expect, beforeEach } from 'vitest';
import { TestClient } from '../test-client';
import { createMockDatabase } from '../mock-database';
import { createMockAuth } from '../mock-auth';
import { testContract, validateResponseSchema } from '../contract-testing';
import type { RequestHandler } from '../types';
import type { MockDatabase } from '../mock-database';
import type { MockAuth } from '../mock-auth';
import type { OpenApiSchema } from '../contract-testing';

// ============================================================
// 1. CRUD Workflow Integration Test
//    model → routes → database
// ============================================================

describe('CRUD Workflow Integration', () => {
  let db: MockDatabase;
  let client: TestClient;
  let idCounter: number;

  // In-memory store simulating a "users" table
  let store: Record<string, { id: string; name: string; email: string; createdAt: string }>;

  beforeEach(() => {
    db = createMockDatabase();
    store = {};
    idCounter = 0;

    // Wire up mock-database handlers that also maintain the in-memory store
    db.onQuery(/INSERT INTO users/, (_sql, params) => {
      const id = params?.[0] as string;
      const name = params?.[1] as string;
      const email = params?.[2] as string;
      const createdAt = params?.[3] as string;
      const record = { id, name, email, createdAt };
      store[id] = record;
      return record;
    });

    db.onQuery(/SELECT \* FROM users WHERE id/, (_sql, params) => {
      const id = params?.[0] as string;
      return store[id] ?? null;
    });

    db.onQuery(/SELECT \* FROM users$/, () => {
      return Object.values(store);
    });


    db.onQuery(/UPDATE users/, (_sql, params) => {
      const id = params?.[0] as string;
      const name = params?.[1] as string;
      const email = params?.[2] as string;
      if (store[id]) {
        store[id] = { ...store[id], name, email };
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    });

    db.onQuery(/DELETE FROM users/, (_sql, params) => {
      const id = params?.[0] as string;
      if (store[id]) {
        delete store[id];
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    });

    // Handler that routes requests to the mock database
    const handler: RequestHandler = (req) => {
      const url = req.url.split('?')[0];
      const method = req.method.toUpperCase();

      // POST /users — create
      if (method === 'POST' && url === '/users') {
        const body = JSON.parse(req.body ?? '{}');
        const id = `usr_${++idCounter}`;
        const createdAt = new Date().toISOString();
        const record = db.query('INSERT INTO users VALUES (?, ?, ?, ?)', [
          id, body.name, body.email, createdAt,
        ]);
        return {
          status: 201,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(record),
        };
      }

      // GET /users/:id — read one
      const singleMatch = url.match(/^\/users\/(.+)$/);
      if (method === 'GET' && singleMatch) {
        const record = db.query('SELECT * FROM users WHERE id = ?', [singleMatch[1]]);
        if (!record) {
          return { status: 404, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Not found' }) };
        }
        return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(record) };
      }

      // GET /users — list
      if (method === 'GET' && url === '/users') {
        const records = db.query('SELECT * FROM users');
        return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(records) };
      }

      // PUT /users/:id — update
      const updateMatch = url.match(/^\/users\/(.+)$/);
      if (method === 'PUT' && updateMatch) {
        const body = JSON.parse(req.body ?? '{}');
        const result = db.execute('UPDATE users SET name = ?, email = ? WHERE id = ?', [
          updateMatch[1], body.name, body.email,
        ]);
        if (result.affectedRows === 0) {
          return { status: 404, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Not found' }) };
        }
        const updated = db.query('SELECT * FROM users WHERE id = ?', [updateMatch[1]]);
        return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(updated) };
      }

      // DELETE /users/:id — delete
      const deleteMatch = url.match(/^\/users\/(.+)$/);
      if (method === 'DELETE' && deleteMatch) {
        const result = db.execute('DELETE FROM users WHERE id = ?', [deleteMatch[1]]);
        if (result.affectedRows === 0) {
          return { status: 404, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Not found' }) };
        }
        return { status: 204, headers: {}, body: '' };
      }

      return { status: 404, headers: {}, body: 'Not found' };
    };

    client = new TestClient(handler);
  });

  it('should complete a full CRUD lifecycle', async () => {
    // CREATE
    const createRes = await client.post('/users', { name: 'Alice', email: 'alice@test.com' });
    createRes.expectStatus(201);
    const created = createRes.json<{ id: string; name: string; email: string; createdAt: string }>();
    expect(created.name).toBe('Alice');
    expect(created.email).toBe('alice@test.com');
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeTruthy();

    // READ
    const getRes = await client.get(`/users/${created.id}`);
    getRes.expectStatus(200);
    getRes.expectJsonMatch({ name: 'Alice', email: 'alice@test.com' });

    // UPDATE
    const updateRes = await client.put(`/users/${created.id}`, { name: 'Alice Updated', email: 'alice2@test.com' });
    updateRes.expectStatus(200);
    const updated = updateRes.json<{ name: string; email: string }>();
    expect(updated.name).toBe('Alice Updated');
    expect(updated.email).toBe('alice2@test.com');

    // DELETE
    const deleteRes = await client.delete(`/users/${created.id}`);
    deleteRes.expectStatus(204);

    // Verify deleted
    const getDeletedRes = await client.get(`/users/${created.id}`);
    getDeletedRes.expectStatus(404);
  });

  it('should record correct database queries', async () => {
    await client.post('/users', { name: 'Bob', email: 'bob@test.com' });
    const queries = db.getQueries();
    expect(queries.length).toBeGreaterThanOrEqual(1);
    expect(queries[0].sql).toContain('INSERT INTO users');
  });

  it('should list all created records', async () => {
    await client.post('/users', { name: 'User1', email: 'u1@test.com' });
    await client.post('/users', { name: 'User2', email: 'u2@test.com' });

    const listRes = await client.get('/users');
    listRes.expectStatus(200);
    const list = listRes.json<unknown[]>();
    expect(list.length).toBe(2);
  });
});


// ============================================================
// 2. Authentication Flow Integration Test
//    login → session → protected route
// ============================================================

function extractSessionId(headers: Record<string, string>): string | null {
  const cookie = headers['cookie'];
  if (!cookie) return null;
  const match = cookie.match(/session=([^;]+)/);
  return match ? match[1] : null;
}

describe('Authentication Flow Integration', () => {
  let auth: MockAuth;
  let client: TestClient;

  beforeEach(() => {
    auth = createMockAuth();

    // API keys store
    const apiKeys: Record<string, { userId: string; scopes: string[] }> = {};

    const handler: RequestHandler = (req) => {
      const url = req.url.split('?')[0];
      const method = req.method.toUpperCase();

      // POST /auth/register — create user
      if (method === 'POST' && url === '/auth/register') {
        const body = JSON.parse(req.body ?? '{}');
        const user = auth.createUser({ email: body.email, name: body.name });
        return {
          status: 201,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: user.id, email: user.email }),
        };
      }

      // POST /auth/login — create session
      if (method === 'POST' && url === '/auth/login') {
        const body = JSON.parse(req.body ?? '{}');
        const users = auth.getUsers();
        const user = users.find((u) => u.email === body.email);
        if (!user) {
          return { status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Invalid credentials' }) };
        }
        const session = auth.createSession(user.id);
        return {
          status: 200,
          headers: { 'content-type': 'application/json', 'set-cookie': `session=${session.id}` },
          body: JSON.stringify({ sessionId: session.id, userId: user.id }),
        };
      }

      // POST /auth/api-key — create API key
      if (method === 'POST' && url === '/auth/api-key') {
        const sessionId = extractSessionId(req.headers);
        const session = sessionId ? auth.validateSession(sessionId) : null;
        if (!session) {
          return { status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) };
        }
        const body = JSON.parse(req.body ?? '{}');
        const key = `wl_${Math.random().toString(36).slice(2, 18)}`;
        apiKeys[key] = { userId: session.userId, scopes: body.scopes ?? ['read'] };
        return {
          status: 201,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key, scopes: apiKeys[key].scopes }),
        };
      }

      // GET /protected — requires session or API key
      if (method === 'GET' && url === '/protected') {
        const sessionId = extractSessionId(req.headers);
        if (sessionId) {
          const session = auth.validateSession(sessionId);
          if (session) {
            return {
              status: 200,
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ message: 'Access granted', userId: session.userId, authMethod: 'session' }),
            };
          }
        }
        const apiKey = req.headers['x-api-key'];
        if (apiKey && apiKeys[apiKey]) {
          return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ message: 'Access granted', userId: apiKeys[apiKey].userId, authMethod: 'api-key' }),
          };
        }
        return { status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      return { status: 404, headers: {}, body: 'Not found' };
    };

    client = new TestClient(handler);
  });

  it('should complete register → login → access protected route flow', async () => {
    const registerRes = await client.post('/auth/register', { email: 'alice@test.com', name: 'Alice' });
    registerRes.expectStatus(201);

    const loginRes = await client.post('/auth/login', { email: 'alice@test.com' });
    loginRes.expectStatus(200);
    const { sessionId } = loginRes.json<{ sessionId: string }>();
    expect(sessionId).toBeTruthy();

    const authedClient = client.withSession(sessionId);
    const protectedRes = await authedClient.get('/protected');
    protectedRes.expectStatus(200);
    protectedRes.expectJsonMatch({ message: 'Access granted', authMethod: 'session' });
  });

  it('should deny access without authentication', async () => {
    const res = await client.get('/protected');
    res.expectStatus(401);
    res.expectJsonMatch({ error: 'Unauthorized' });
  });

  it('should deny access with an invalid session', async () => {
    const authedClient = client.withSession('invalid-session-id');
    const res = await authedClient.get('/protected');
    res.expectStatus(401);
  });

  it('should support API key authentication flow', async () => {
    await client.post('/auth/register', { email: 'bob@test.com', name: 'Bob' });
    const loginRes = await client.post('/auth/login', { email: 'bob@test.com' });
    const { sessionId } = loginRes.json<{ sessionId: string }>();

    const authedClient = client.withSession(sessionId);
    const keyRes = await authedClient.post('/auth/api-key', { scopes: ['read', 'write'] });
    keyRes.expectStatus(201);
    const { key } = keyRes.json<{ key: string; scopes: string[] }>();
    expect(key).toBeTruthy();

    const apiKeyClient = client.withApiKey(key);
    const protectedRes = await apiKeyClient.get('/protected');
    protectedRes.expectStatus(200);
    protectedRes.expectJsonMatch({ message: 'Access granted', authMethod: 'api-key' });
  });

  it('should reject invalid API key', async () => {
    const apiKeyClient = client.withApiKey('invalid-key');
    const res = await apiKeyClient.get('/protected');
    res.expectStatus(401);
  });
});


// ============================================================
// 3. Code Generation Workflow Integration Test
//    model → OpenAPI → client (contract validation)
// ============================================================

describe('Code Generation Workflow Integration', () => {
  it('should validate handler responses against an OpenAPI spec', async () => {
    const userSchema: OpenApiSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['id', 'name', 'email'],
    };

    const openApiSpec = {
      openapi: '3.1.0',
      info: { title: 'Test API', version: '1.0.0' },
      components: { schemas: { User: userSchema } },
      paths: {
        '/users': {
          get: {
            responses: {
              '200': {
                description: 'List users',
                content: {
                  'application/json': {
                    schema: { type: 'array', items: { $ref: '#/components/schemas/User' } },
                  },
                },
              },
            },
          },
          post: {
            responses: {
              '201': {
                description: 'Create user',
                content: {
                  'application/json': { schema: { $ref: '#/components/schemas/User' } },
                },
              },
            },
          },
        },
      },
    };

    const handler: RequestHandler = (req) => {
      if (req.method === 'GET' && req.url === '/users') {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify([{ id: '1', name: 'Alice', email: 'alice@test.com' }]),
        };
      }
      if (req.method === 'POST' && req.url === '/users') {
        return {
          status: 201,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: '2', name: 'Bob', email: 'bob@test.com' }),
        };
      }
      return { status: 404, headers: {}, body: '' };
    };

    const result = await testContract(handler, openApiSpec);
    expect(result.passed).toBe(true);
    expect(result.results.length).toBe(2);
    for (const r of result.results) {
      for (const check of r.checks) {
        expect(check.passed).toBe(true);
      }
    }
  });

  it('should detect schema mismatches between handler and spec', async () => {
    const openApiSpec = {
      openapi: '3.1.0',
      info: { title: 'Test API', version: '1.0.0' },
      components: {
        schemas: {
          Product: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              title: { type: 'string' },
              price: { type: 'number' },
            },
            required: ['id', 'title', 'price'],
          },
        },
      },
      paths: {
        '/products': {
          get: {
            responses: {
              '200': {
                description: 'List products',
                content: {
                  'application/json': { schema: { $ref: '#/components/schemas/Product' } },
                },
              },
            },
          },
        },
      },
    };

    // Handler returns response missing required "price" field
    const handler: RequestHandler = () => ({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 1, title: 'Widget' }),
    });

    const result = await testContract(handler, openApiSpec);
    const schemaChecks = result.results
      .flatMap((r) => r.checks)
      .filter((c) => c.type === 'schema');
    expect(schemaChecks.length).toBeGreaterThan(0);
    expect(schemaChecks.some((c) => !c.passed)).toBe(true);
  });

  it('should validate response schema directly', () => {
    const schema: OpenApiSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['id', 'name'],
    };

    const validResult = validateResponseSchema({ id: '1', name: 'Alice' }, schema);
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toHaveLength(0);

    const invalidResult = validateResponseSchema({ id: '1' }, schema);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });

  it('should detect status code mismatches', async () => {
    const openApiSpec = {
      openapi: '3.1.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/items': {
          get: {
            responses: {
              '200': {
                description: 'OK',
                content: { 'application/json': { schema: { type: 'object' } } },
              },
            },
          },
        },
      },
    };

    const handler: RequestHandler = () => ({
      status: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Internal error' }),
    });

    const result = await testContract(handler, openApiSpec);
    const statusChecks = result.results
      .flatMap((r) => r.checks)
      .filter((c) => c.type === 'status');
    expect(statusChecks.some((c) => !c.passed)).toBe(true);
  });
});
