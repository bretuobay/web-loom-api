# Testing Strategies

Web Loom API provides comprehensive testing utilities through `@web-loom/api-testing`. This guide covers unit tests, property-based tests, contract tests, and benchmarks.

## Setup

```bash
npm install -D @web-loom/api-testing vitest fast-check @faker-js/faker
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

## Unit Testing with TestClient

The `TestClient` simulates HTTP requests without network calls:

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

  it('validates required fields', async () => {
    const res = await client.post('/users', {});
    expect(res.status).toBe(400);
    expect(res.json().error.details.fields).toContainEqual(
      expect.objectContaining({ path: ['name'], code: 'required' })
    );
  });

  it('returns 404 for missing user', async () => {
    const res = await client.get('/users/nonexistent-id');
    expect(res.status).toBe(404);
  });
});
```

### Testing Authenticated Routes

```typescript
describe('Protected Routes', () => {
  it('returns 401 without auth', async () => {
    const res = await client.get('/admin/users');
    expect(res.status).toBe(401);
  });

  it('allows admin access', async () => {
    client.authenticate({ id: '1', role: 'admin' });
    const res = await client.get('/admin/users');
    expect(res.status).toBe(200);
  });

  it('allows API key access', async () => {
    client.setApiKey('test-api-key');
    const res = await client.get('/api/data');
    expect(res.status).toBe(200);
  });
});
```

## Test Factories

Generate realistic test data:

```typescript
import { defineFactory, seed } from '@web-loom/api-testing';
import { faker } from '@faker-js/faker';
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

// Seed many records
await seed(User, 50, userFactory);
```

## In-Memory Database Testing

Use `libsql` with an in-memory SQLite database for fast, isolated integration tests:

```typescript
import { createApp, defineConfig } from '@web-loom/api-core';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { drizzle } from 'drizzle-orm/libsql';

describe('Users API (integration)', () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    app = await createApp(
      defineConfig({
        database: { url: ':memory:', driver: 'libsql' },
      })
    );
    // Run migrations on the in-memory DB
    await migrate(app.db, { migrationsFolder: './drizzle' });
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

## Property-Based Testing

Use `fast-check` to verify properties hold across all valid inputs:

```typescript
import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

// Property 1: Configuration Round-Trip Preservation
// Validates: Requirements 45.1
describe('Configuration round-trip', () => {
  const configGenerator = fc.record({
    database: fc.record({
      url: fc.webUrl(),
      driver: fc.constantFrom('neon-serverless', 'libsql', 'pg'),
      poolSize: fc.integer({ min: 1, max: 100 }),
    }),
    security: fc.record({
      cors: fc.record({
        origins: fc.array(fc.webUrl(), { minLength: 1 }),
      }),
    }),
  });

  it('preserves data through format cycle', () => {
    fc.assert(
      fc.property(configGenerator, (config) => {
        const formatted = formatConfig(parseConfig(config));
        const reparsed = parseConfig(formatted);
        expect(reparsed).toEqual(config);
      }),
      { numRuns: 100 }
    );
  });
});
```

### Model Serialization Property

```typescript
// Property 2: Model Serialization Round-Trip
// Validates: Requirements 46.1, 46.2
describe('Model serialization', () => {
  const userGenerator = fc.record({
    name: fc.string({ minLength: 1, maxLength: 100 }),
    email: fc.emailAddress(),
    role: fc.constantFrom('user', 'admin', 'moderator'),
    createdAt: fc.date(),
  });

  it('preserves data through JSON round-trip', () => {
    fc.assert(
      fc.property(userGenerator, (userData) => {
        const serialized = JSON.stringify(userData);
        const deserialized = JSON.parse(serialized);
        expect(deserialized.name).toBe(userData.name);
        expect(deserialized.email).toBe(userData.email);
        expect(deserialized.role).toBe(userData.role);
      }),
      { numRuns: 100 }
    );
  });
});
```

### CRUD Generation Property

```typescript
// Property 7: CRUD Endpoint Generation Completeness
// Validates: Requirements 5.1-5.6
describe('CRUD generation', () => {
  const modelGenerator = fc.record({
    name: fc
      .string({ minLength: 1, maxLength: 50 })
      .map((s) => s.replace(/[^a-zA-Z]/g, 'A').slice(0, 20) || 'Model'),
    fields: fc.array(
      fc.record({
        name: fc.constantFrom('id', 'title', 'status'),
        type: fc.constantFrom('uuid', 'string', 'enum'),
      }),
      { minLength: 1 }
    ),
  });

  it('generates all six CRUD endpoints', () => {
    fc.assert(
      fc.property(modelGenerator, (modelDef) => {
        const routes = crudGenerator.generate(modelDef);
        expect(routes).toHaveProperty('create');
        expect(routes).toHaveProperty('list');
        expect(routes).toHaveProperty('get');
        expect(routes).toHaveProperty('update');
        expect(routes).toHaveProperty('patch');
        expect(routes).toHaveProperty('delete');
      }),
      { numRuns: 100 }
    );
  });
});
```

## Contract Testing

Verify your API matches its OpenAPI specification:

```typescript
import { testContract } from '@web-loom/api-testing';

describe('API Contract', () => {
  it('matches OpenAPI spec', async () => {
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
    if (!result.passed) {
      console.log('Violations:', result.violations);
    }
  });
});
```

## Benchmarking

Measure performance of critical paths:

```typescript
import { benchmark } from '@web-loom/api-testing';

describe('Performance', () => {
  it('cold start under 100ms', async () => {
    const result = await benchmark(
      'cold start',
      async () => {
        const app = await createApp(config);
      },
      { maxDuration: 100, iterations: 50 }
    );

    expect(result.p95).toBeLessThan(100);
  });

  it('handles 1000 requests/sec', async () => {
    const app = await createApp(config);
    const client = createTestClient(app);

    const result = await benchmark(
      'GET /users',
      async () => {
        await client.get('/users');
      },
      { iterations: 1000 }
    );

    console.log(`p50: ${result.p50}ms, p95: ${result.p95}ms, p99: ${result.p99}ms`);
  });
});
```

## Test Organization

```
src/
├── models/
│   └── user.ts
├── routes/
│   └── users.ts
tests/
├── unit/
│   ├── models/user.test.ts
│   └── routes/users.test.ts
├── property/
│   ├── config-roundtrip.test.ts
│   └── model-serialization.test.ts
├── integration/
│   ├── crud-endpoints.test.ts
│   └── auth-flow.test.ts
├── contract/
│   └── openapi.test.ts
└── fixtures/
    └── factories.ts
```

## Running Tests

```bash
# All tests
npx vitest --run

# Unit tests only
npx vitest --run tests/unit

# Property tests
npx vitest --run tests/property

# With coverage
npx vitest --run --coverage

# Contract tests (requires running server)
npx vitest --run tests/contract
```
