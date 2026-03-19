# API Reference: @web-loom/api-testing

Testing utilities for unit, integration, contract, and property-based testing.

## TestClient

Simulates HTTP requests against your app without network calls.

### `createTestClient(app)`

```typescript
function createTestClient(app: Application): TestClient;

interface TestClient {
  get(path: string, options?: RequestOptions): Promise<TestResponse>;
  post(path: string, body?: unknown, options?: RequestOptions): Promise<TestResponse>;
  put(path: string, body?: unknown, options?: RequestOptions): Promise<TestResponse>;
  patch(path: string, body?: unknown, options?: RequestOptions): Promise<TestResponse>;
  delete(path: string, options?: RequestOptions): Promise<TestResponse>;

  authenticate(user: User): void;
  setApiKey(key: string): void;
  setHeader(name: string, value: string): void;

  expect(response: TestResponse): ResponseAssertions;
}

interface RequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, string>;
}
```

**Usage:**

```typescript
import { createTestClient } from '@web-loom/api-testing';
import { createApp } from '@web-loom/api-core';
import config from '../src/config';

describe('Users API', () => {
  let client: TestClient;

  beforeAll(async () => {
    const app = await createApp(config);
    client = createTestClient(app);
  });

  it('creates a user', async () => {
    const res = await client.post('/users', {
      name: 'Alice',
      email: 'alice@example.com',
    });

    expect(res.status).toBe(201);
    expect(res.json().user.name).toBe('Alice');
  });

  it('returns 400 for invalid data', async () => {
    const res = await client.post('/users', { name: '' });
    expect(res.status).toBe(400);
  });

  it('requires auth for admin routes', async () => {
    const res = await client.get('/admin/users');
    expect(res.status).toBe(401);
  });

  it('allows admin access', async () => {
    client.authenticate({ id: '1', role: 'admin' });
    const res = await client.get('/admin/users');
    expect(res.status).toBe(200);
  });
});
```

### TestResponse

```typescript
interface TestResponse {
  status: number;
  headers: Headers;
  body: unknown;
  json<T>(): T;
  text(): string;
}
```

### ResponseAssertions

```typescript
interface ResponseAssertions {
  toHaveStatus(status: number): void;
  toHaveHeader(name: string, value?: string): void;
  toMatchSchema(schema: Schema): void;
  toHaveBody(body: unknown): void;
}
```

```typescript
const res = await client.get('/users/123');
client.expect(res).toHaveStatus(200);
client.expect(res).toHaveHeader('Content-Type', 'application/json');
client.expect(res).toMatchSchema(userSchema);
```

---

## Factories

Generate test data with `defineFactory()`.

### `defineFactory(model, overrides)`

```typescript
function defineFactory<T>(
  model: Model,
  overrides: Partial<Record<keyof T, unknown | (() => unknown)>>
): Factory<T>;

interface Factory<T> {
  build(overrides?: Partial<T>): T;
  buildMany(count: number, overrides?: Partial<T>): T[];
  create(overrides?: Partial<T>): Promise<T>;
  createMany(count: number, overrides?: Partial<T>): Promise<T[]>;
}
```

**Usage:**

```typescript
import { defineFactory } from '@web-loom/api-testing';
import { User } from '../src/models/user';

const userFactory = defineFactory(User, {
  name: () => faker.person.fullName(),
  email: () => faker.internet.email(),
  role: 'user',
});

// Build in-memory (no DB)
const user = userFactory.build();
const users = userFactory.buildMany(10);

// Create in database
const dbUser = await userFactory.create({ role: 'admin' });
const dbUsers = await userFactory.createMany(5);
```

---

## Database Seeding

### `seed(model, count, factory)`

```typescript
function seed<T>(model: Model, count: number, factory: Factory<T>): Promise<T[]>;
```

**Usage:**

```typescript
import { seed } from '@web-loom/api-testing';

await seed(User, 50, userFactory);
await seed(Post, 200, postFactory);
```

---

## In-Memory Database for Integration Tests

The recommended approach for integration testing is to use the `libsql` driver with an in-memory SQLite database. This requires no external services and is fast enough to run in CI:

```typescript
import { createApp } from '@web-loom/api-core';
import { defineConfig } from '@web-loom/api-core';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';

async function createTestApp() {
  const testConfig = defineConfig({
    database: {
      url: ':memory:', // in-memory SQLite — no external service
      driver: 'libsql',
    },
  });

  const app = await createApp(testConfig);

  // Run migrations to set up the schema
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: './migrations' });

  return app;
}
```

Each test suite gets a fresh in-memory database:

```typescript
describe('Users API', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('creates a user', async () => {
    const res = await app.handleRequest(
      new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
      })
    );
    expect(res.status).toBe(201);
  });
});
```

### `createMockEmail()`

```typescript
function createMockEmail(): MockEmailAdapter;

interface MockEmailAdapter extends EmailAdapter {
  getSentEmails(): EmailMessage[];
  getLastEmail(): EmailMessage | undefined;
  reset(): void;
}
```

**Usage:**

```typescript
import { createMockEmail } from '@web-loom/api-testing';

const mockEmail = createMockEmail();
// ... trigger email sending ...
expect(mockEmail.getSentEmails()).toHaveLength(1);
expect(mockEmail.getLastEmail()?.to).toBe('user@example.com');
```

---

## Contract Testing

### `testContract(options)`

Verifies your API matches its OpenAPI specification.

```typescript
function testContract(options: ContractTestOptions): Promise<ContractTestResult>;

interface ContractTestOptions {
  spec: string; // Path to OpenAPI JSON file
  baseUrl: string; // API base URL
  tests?: {
    validateSchemas?: boolean; // Validate response schemas
    validateStatusCodes?: boolean; // Validate status codes
    validateHeaders?: boolean; // Validate response headers
  };
}
```

**Usage:**

```typescript
import { testContract } from '@web-loom/api-testing';

const result = await testContract({
  spec: './openapi.json',
  baseUrl: 'http://localhost:3000',
  tests: {
    validateSchemas: true,
    validateStatusCodes: true,
    validateHeaders: true,
  },
});

expect(result.passed).toBe(true);
```

---

## Benchmarking

### `benchmark(name, fn, options)`

```typescript
function benchmark(
  name: string,
  fn: () => Promise<void>,
  options?: BenchmarkOptions
): Promise<BenchmarkResult>;

interface BenchmarkOptions {
  maxDuration?: number; // Max duration in ms
  iterations?: number; // Number of iterations
}

interface BenchmarkResult {
  name: string;
  iterations: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}
```

**Usage:**

```typescript
import { benchmark } from '@web-loom/api-testing';

const result = await benchmark(
  'cold start',
  async () => {
    const app = await createApp(config);
  },
  { maxDuration: 100, iterations: 50 }
);

expect(result.p95).toBeLessThan(100);
```
