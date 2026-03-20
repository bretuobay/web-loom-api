# @web-loom/api-testing

Testing utilities for [Web Loom API](https://github.com/bretuobay/web-loom-api). HTTP test client, data factories with database seeding, mock adapters, benchmarking, and contract testing against OpenAPI specs.

## Installation

```bash
npm install --save-dev @web-loom/api-testing
```

## HTTP Test Client

`TestClient` wraps the Web Loom `Application` and provides a fluent API for writing integration tests without spinning up a real server.

```typescript
import { TestClient } from '@web-loom/api-testing';
import { createApp } from '@web-loom/api-core';
import config from '../webloom.config';

let client: TestClient;

beforeAll(async () => {
  const app = await createApp(config);
  client = new TestClient(app);
});

test('GET /users returns 200', async () => {
  const res = await client.get('/users');
  expect(res.status).toBe(200);

  const body = await res.json();
  expect(body.users).toBeInstanceOf(Array);
});

test('POST /users creates a user', async () => {
  const res = await client
    .post('/users')
    .json({ name: 'Alice', email: 'alice@example.com', password: 'secret123' });

  expect(res.status).toBe(201);
});

test('Protected route requires auth', async () => {
  const res = await client.get('/admin/users').header('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
});
```

## Data Factories & Seeding

```typescript
import { Factory, Seeder } from '@web-loom/api-testing';
import { usersTable } from '../src/schema';
import { faker } from '@faker-js/faker';

const userFactory = new Factory(usersTable, () => ({
  name: faker.person.fullName(),
  email: faker.internet.email(),
  passwordHash: '$2a$12$hashed',
}));

// Create a single user record
const user = await userFactory.create(db);

// Create 20 users
const users = await userFactory.createMany(db, 20);

// Seed the database with predefined fixtures
const seeder = new Seeder(db);
await seeder.seed([{ factory: userFactory, count: 10 }]);
```

## Mock Adapters

```typescript
import { MockDatabase, MockAuthAdapter, MockEmailAdapter } from '@web-loom/api-testing';

// Mock database returns in-memory data instead of hitting a real DB
const mockDb = new MockDatabase();
mockDb.mockQuery('SELECT * FROM users', [{ id: '1', name: 'Alice' }]);

// Mock email adapter captures sends without delivering
const mockEmail = new MockEmailAdapter();
await mockEmail.send({ to: 'user@example.com', subject: 'Test', html: '<p>Hi</p>' });
expect(mockEmail.sent).toHaveLength(1);
expect(mockEmail.sent[0].to).toBe('user@example.com');
```

## Contract Testing

Verify your API conforms to its OpenAPI spec:

```typescript
import { ContractTester } from '@web-loom/api-testing';

const tester = new ContractTester({ specPath: './openapi.json' });

test('API conforms to OpenAPI spec', async () => {
  const violations = await tester.test(client, {
    endpoints: [
      { method: 'GET', path: '/users' },
      { method: 'POST', path: '/users' },
      { method: 'GET', path: '/users/123' },
    ],
  });
  expect(violations).toHaveLength(0);
});
```

## Benchmarking

```typescript
import { Benchmark } from '@web-loom/api-testing';

const bench = new Benchmark(client);

const results = await bench.run({
  endpoint: { method: 'GET', path: '/users' },
  duration: 10_000, // 10 seconds
  concurrency: 10,
});

console.log(`Throughput: ${results.requestsPerSecond} req/s`);
console.log(`P50: ${results.p50}ms  P99: ${results.p99}ms`);
console.log(`Cold start: ${results.coldStartMs}ms`);
```

## Exports

| Export             | Description                                     |
| ------------------ | ----------------------------------------------- |
| `TestClient`       | Fluent HTTP test client                         |
| `Factory`          | Data factory for generating test records        |
| `Seeder`           | Database seeder using factories                 |
| `MockDatabase`     | In-memory database mock                         |
| `MockAuthAdapter`  | Auth adapter that always succeeds / fails       |
| `MockEmailAdapter` | Email adapter that captures sends               |
| `ContractTester`   | OpenAPI contract validator                      |
| `Benchmark`        | Latency, throughput, and cold-start benchmarker |

## License

MIT
