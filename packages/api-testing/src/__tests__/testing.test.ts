import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestClient,
  defineFactory,
  seed,
  randomString,
  randomInt,
  randomEmail,
  randomDate,
  randomUUID,
  sequence,
  resetSequence,
  createMockDatabase,
  createMockAuth,
  createMockEmail,
} from '../index';
import type { RequestHandler, TestResponseData } from '../types';

// ---- Test Client ----

describe('TestClient', () => {
  function createHandler(responses?: Record<string, TestResponseData>): RequestHandler {
    return (req) => {
      const key = `${req.method} ${req.url.split('?')[0]}`;
      if (responses && responses[key]) {
        return responses[key];
      }
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: req.body ? JSON.parse(req.body) : undefined,
        }),
      };
    };
  }

  it('should make GET requests', async () => {
    const client = new TestClient(createHandler());
    const res = await client.get('/users');
    expect(res.status).toBe(200);
    const json = res.json<{ method: string }>();
    expect(json.method).toBe('GET');
  });

  it('should make POST requests with body', async () => {
    const client = new TestClient(createHandler());
    const res = await client.post('/users', { name: 'Alice' });
    const json = res.json<{ body: { name: string } }>();
    expect(json.body.name).toBe('Alice');
  });

  it('should make PUT, PATCH, DELETE requests', async () => {
    const client = new TestClient(createHandler());

    const putRes = await client.put('/users/1', { name: 'Bob' });
    expect(putRes.json<{ method: string }>().method).toBe('PUT');

    const patchRes = await client.patch('/users/1', { name: 'Charlie' });
    expect(patchRes.json<{ method: string }>().method).toBe('PATCH');

    const delRes = await client.delete('/users/1');
    expect(delRes.json<{ method: string }>().method).toBe('DELETE');
  });

  it('should support query parameters', async () => {
    const client = new TestClient(createHandler());
    const res = await client.get('/users', { query: { page: 1, limit: 10 } });
    const json = res.json<{ url: string }>();
    expect(json.url).toContain('page=1');
    expect(json.url).toContain('limit=10');
  });

  it('should support session authentication', async () => {
    const client = new TestClient(createHandler());
    const authed = client.withSession('sess-123');
    const res = await authed.get('/me');
    const json = res.json<{ headers: Record<string, string> }>();
    expect(json.headers.cookie).toBe('session=sess-123');
  });

  it('should support API key authentication', async () => {
    const client = new TestClient(createHandler());
    const authed = client.withApiKey('key-abc');
    const res = await authed.get('/me');
    const json = res.json<{ headers: Record<string, string> }>();
    expect(json.headers['x-api-key']).toBe('key-abc');
  });

  it('should support Bearer token authentication', async () => {
    const client = new TestClient(createHandler());
    const authed = client.withBearerToken('tok-xyz');
    const res = await authed.get('/me');
    const json = res.json<{ headers: Record<string, string> }>();
    expect(json.headers.authorization).toBe('Bearer tok-xyz');
  });

  it('should chain assertions', async () => {
    const client = new TestClient(
      createHandler({
        'GET /health': {
          status: 200,
          headers: { 'content-type': 'application/json', 'x-version': '1.0' },
          body: JSON.stringify({ status: 'ok' }),
        },
      })
    );

    const res = await client.get('/health');
    res
      .expectStatus(200)
      .expectHeader('content-type', 'application/json')
      .expectHeader('x-version', '1.0')
      .expectBodyContains('ok')
      .expectJsonMatch({ status: 'ok' });
  });

  it('should throw on failed status assertion', async () => {
    const client = new TestClient(
      createHandler({
        'GET /fail': { status: 404, headers: {}, body: 'not found' },
      })
    );
    const res = await client.get('/fail');
    expect(() => res.expectStatus(200)).toThrow('Expected status 200, got 404');
  });

  it('should throw on failed header assertion', async () => {
    const client = new TestClient(
      createHandler({
        'GET /test': { status: 200, headers: { 'x-foo': 'bar' }, body: '' },
      })
    );
    const res = await client.get('/test');
    expect(() => res.expectHeader('x-foo', 'baz')).toThrow();
  });

  it('should throw on failed body contains assertion', async () => {
    const client = new TestClient(
      createHandler({
        'GET /test': { status: 200, headers: {}, body: 'hello world' },
      })
    );
    const res = await client.get('/test');
    expect(() => res.expectBodyContains('missing')).toThrow();
  });

  it('should validate schema', async () => {
    const client = new TestClient(
      createHandler({
        'GET /data': {
          status: 200,
          headers: {},
          body: JSON.stringify({ name: 'test', age: 25 }),
        },
      })
    );
    const res = await client.get('/data');

    const goodSchema = {
      validate: () => ({ success: true }),
    };
    expect(() => res.expectSchema(goodSchema)).not.toThrow();

    const badSchema = {
      validate: () => ({ success: false, errors: ['missing field'] }),
    };
    expect(() => res.expectSchema(badSchema)).toThrow('Schema validation failed');
  });

  it('should call request and response interceptors', async () => {
    const client = new TestClient(createHandler());
    const requestLog: string[] = [];
    const responseLog: number[] = [];

    client.onRequest((req) => {
      requestLog.push(`${req.method} ${req.path}`);
    });
    client.onResponse((res) => {
      responseLog.push(res.status);
    });

    await client.get('/test');
    expect(requestLog).toEqual(['GET /test']);
    expect(responseLog).toEqual([200]);
  });

  it('should not mutate original client when adding auth', async () => {
    const client = new TestClient(createHandler());
    const authed = client.withApiKey('key-1');

    const res1 = await client.get('/test');
    const json1 = res1.json<{ headers: Record<string, string> }>();
    expect(json1.headers['x-api-key']).toBeUndefined();

    const res2 = await authed.get('/test');
    const json2 = res2.json<{ headers: Record<string, string> }>();
    expect(json2.headers['x-api-key']).toBe('key-1');
  });
});

// ---- Factory & Seeding ----

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
}

interface Post {
  id: string;
  title: string;
  authorId: string;
  author?: User;
}

describe('defineFactory', () => {
  it('should build instances with default attributes', () => {
    const userFactory = defineFactory<User>('user', {
      id: '1',
      name: 'Default User',
      email: 'default@test.com',
      age: 25,
    });

    const user = userFactory.build();
    expect(user.name).toBe('Default User');
    expect(user.email).toBe('default@test.com');
  });

  it('should allow overrides', () => {
    const userFactory = defineFactory<User>('user', {
      id: '1',
      name: 'Default',
      email: 'default@test.com',
      age: 25,
    });

    const user = userFactory.build({ name: 'Custom', age: 30 });
    expect(user.name).toBe('Custom');
    expect(user.age).toBe(30);
    expect(user.email).toBe('default@test.com');
  });

  it('should support generator functions for dynamic defaults', () => {
    let counter = 0;
    const userFactory = defineFactory<User>('user', () => ({
      id: String(++counter),
      name: `User ${counter}`,
      email: `user${counter}@test.com`,
      age: 20 + counter,
    }));

    const u1 = userFactory.build();
    const u2 = userFactory.build();
    expect(u1.id).not.toBe(u2.id);
    expect(u1.name).not.toBe(u2.name);
  });

  it('should build many instances', () => {
    const userFactory = defineFactory<User>('user', () => ({
      id: randomUUID(),
      name: 'User',
      email: randomEmail(),
      age: randomInt(18, 65),
    }));

    const users = userFactory.buildMany(5);
    expect(users).toHaveLength(5);
    // Each should have unique IDs (from randomUUID)
    const ids = new Set(users.map((u) => u.id));
    expect(ids.size).toBe(5);
  });

  it('should create persisted instances', async () => {
    const store: User[] = [];
    const userFactory = defineFactory<User>(
      'user',
      () => ({
        id: randomUUID(),
        name: 'User',
        email: randomEmail(),
        age: 25,
      }),
      async (data) => {
        store.push(data);
        return data;
      }
    );

    const user = await userFactory.create({ name: 'Persisted' });
    expect(user.name).toBe('Persisted');
    expect(store).toHaveLength(1);
  });

  it('should support relationships', () => {
    const userFactory = defineFactory<User>('user', () => ({
      id: randomUUID(),
      name: 'Author',
      email: randomEmail(),
      age: 30,
    }));

    const postFactory = defineFactory<Post>('post', () => ({
      id: randomUUID(),
      title: 'Test Post',
      authorId: '',
    })).withRelation('author', userFactory);

    const post = postFactory.build();
    expect(post.author).toBeDefined();
    expect((post.author as User).name).toBe('Author');
  });
});

describe('seed', () => {
  it('should bulk create data from multiple factories', async () => {
    const userFactory = defineFactory<User>('user', () => ({
      id: randomUUID(),
      name: 'User',
      email: randomEmail(),
      age: 25,
    }));

    const postFactory = defineFactory<Post>('post', () => ({
      id: randomUUID(),
      title: 'Post',
      authorId: randomUUID(),
    }));

    const data = await seed({
      users: { factory: userFactory, count: 3 },
      posts: { factory: postFactory, count: 5, overrides: { title: 'Seeded' } },
    });

    expect(data.users).toHaveLength(3);
    expect(data.posts).toHaveLength(5);
    expect(data.posts[0].title).toBe('Seeded');
  });
});

describe('generators', () => {
  it('randomString should generate string of given length', () => {
    const s = randomString(20);
    expect(s).toHaveLength(20);
    expect(typeof s).toBe('string');
  });

  it('randomInt should be within range', () => {
    for (let i = 0; i < 50; i++) {
      const n = randomInt(5, 10);
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThanOrEqual(10);
    }
  });

  it('randomEmail should look like an email', () => {
    const email = randomEmail();
    expect(email).toContain('@');
    expect(email).toContain('.test');
  });

  it('randomDate should return a Date', () => {
    const d = randomDate();
    expect(d).toBeInstanceOf(Date);
    expect(d.getTime()).toBeGreaterThan(0);
  });

  it('randomUUID should match UUID v4 format', () => {
    const uuid = randomUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('sequence should produce incrementing values', () => {
    resetSequence();
    expect(sequence('user')).toBe('user-1');
    expect(sequence('user')).toBe('user-2');
    expect(sequence('post')).toBe('post-3');
  });
});

// ---- Mock Database ----

describe('createMockDatabase', () => {
  let db: ReturnType<typeof createMockDatabase>;

  beforeEach(() => {
    db = createMockDatabase();
  });

  it('should record queries', () => {
    db.query('SELECT * FROM users');
    db.query('SELECT * FROM posts WHERE id = ?', [1]);

    const queries = db.getQueries();
    expect(queries).toHaveLength(2);
    expect(queries[0].sql).toBe('SELECT * FROM users');
    expect(queries[1].params).toEqual([1]);
  });

  it('should return mocked results via onQuery', () => {
    db.onQuery('SELECT', () => [{ id: 1, name: 'Alice' }]);

    const result = db.query<Array<{ id: number; name: string }>>('SELECT * FROM users');
    expect(result).toEqual([{ id: 1, name: 'Alice' }]);
  });

  it('should match regex patterns', () => {
    db.onQuery(/INSERT INTO users/, () => ({ affectedRows: 1 }));

    const result = db.execute('INSERT INTO users (name) VALUES (?)', ['Bob']);
    expect(result.affectedRows).toBe(1);
  });

  it('should support transactions', async () => {
    db.onQuery('INSERT', () => ({ affectedRows: 1 }));

    const result = await db.transaction(async (tx) => {
      tx.execute('INSERT INTO users (name) VALUES (?)', ['Alice']);
      tx.execute('INSERT INTO users (name) VALUES (?)', ['Bob']);
      return tx.getQueries().length;
    });

    expect(result).toBe(2);
    // Parent db should also have the queries
    expect(db.getQueries()).toHaveLength(2);
  });

  it('should reset all state', () => {
    db.onQuery('SELECT', () => [{ id: 1 }]);
    db.query('SELECT 1');

    db.reset();
    expect(db.getQueries()).toHaveLength(0);
    // Handler should be cleared too
    const result = db.query<unknown[]>('SELECT 1');
    expect(result).toEqual([]);
  });
});

// ---- Mock Auth ----

describe('createMockAuth', () => {
  let auth: ReturnType<typeof createMockAuth>;

  beforeEach(() => {
    auth = createMockAuth();
  });

  it('should create users', () => {
    const user = auth.createUser({ email: 'alice@test.com', name: 'Alice' });
    expect(user.id).toBeDefined();
    expect(user.email).toBe('alice@test.com');
    expect(user.role).toBe('user');
  });

  it('should create sessions for existing users', () => {
    const user = auth.createUser({ email: 'bob@test.com' });
    const session = auth.createSession(user.id);

    expect(session.userId).toBe(user.id);
    expect(session.id).toBeDefined();
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('should throw when creating session for non-existent user', () => {
    expect(() => auth.createSession('nonexistent')).toThrow('User not found');
  });

  it('should validate active sessions', () => {
    const user = auth.createUser({ email: 'test@test.com' });
    const session = auth.createSession(user.id);

    const validated = auth.validateSession(session.id);
    expect(validated).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(validated!.userId).toBe(user.id);
  });

  it('should return null for invalid session IDs', () => {
    expect(auth.validateSession('invalid-id')).toBeNull();
  });

  it('should return null for expired sessions', () => {
    const user = auth.createUser({ email: 'test@test.com' });
    const session = auth.createSession(user.id, { expiresIn: -1000 });

    expect(auth.validateSession(session.id)).toBeNull();
  });

  it('should list all users', () => {
    auth.createUser({ email: 'a@test.com' });
    auth.createUser({ email: 'b@test.com' });

    expect(auth.getUsers()).toHaveLength(2);
  });

  it('should reset all state', () => {
    const user = auth.createUser({ email: 'test@test.com' });
    auth.createSession(user.id);

    auth.reset();
    expect(auth.getUsers()).toHaveLength(0);
    expect(auth.getSessions()).toHaveLength(0);
  });
});

// ---- Mock Email ----

describe('createMockEmail', () => {
  let email: ReturnType<typeof createMockEmail>;

  beforeEach(() => {
    email = createMockEmail();
  });

  it('should record sent emails', () => {
    email.send({
      to: 'user@test.com',
      subject: 'Welcome',
      text: 'Hello!',
    });

    expect(email.getSentEmails()).toHaveLength(1);
    expect(email.getSentEmails()[0].subject).toBe('Welcome');
  });

  it('should return the last sent email', () => {
    email.send({ to: 'a@test.com', subject: 'First' });
    email.send({ to: 'b@test.com', subject: 'Second' });

    const last = email.getLastEmail();
    expect(last?.subject).toBe('Second');
  });

  it('should return undefined when no emails sent', () => {
    expect(email.getLastEmail()).toBeUndefined();
  });

  it('should filter emails by recipient', () => {
    email.send({ to: 'alice@test.com', subject: 'For Alice' });
    email.send({ to: 'bob@test.com', subject: 'For Bob' });
    email.send({ to: ['alice@test.com', 'charlie@test.com'], subject: 'Group' });

    const aliceEmails = email.getEmailsTo('alice@test.com');
    expect(aliceEmails).toHaveLength(2);
    expect(aliceEmails[0].subject).toBe('For Alice');
    expect(aliceEmails[1].subject).toBe('Group');
  });

  it('should record sentAt timestamp', () => {
    const before = new Date();
    const msg = email.send({ to: 'test@test.com', subject: 'Test' });
    expect(msg.sentAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('should reset all state', () => {
    email.send({ to: 'test@test.com', subject: 'Test' });
    email.reset();
    expect(email.getSentEmails()).toHaveLength(0);
  });
});
