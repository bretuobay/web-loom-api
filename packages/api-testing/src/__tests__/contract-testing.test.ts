import { describe, it, expect } from 'vitest';
import {
  testContract,
  validateResponseSchema,
  validateStatusCode,
  validateResponseHeaders,
  parseOpenApiSpec,
} from '../contract-testing';
import type { RequestHandler } from '../types';
import type { OpenApiSchema } from '../contract-testing';

// ---- Helper: minimal OpenAPI spec ----

function createOpenApiSpec(overrides?: Record<string, unknown>) {
  return {
    openapi: '3.0.3',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {
      '/users': {
        get: {
          responses: {
            '200': {
              description: 'List users',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
        post: {
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateUser' },
              },
            },
          },
          responses: {
            '201': {
              description: 'User created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' },
                },
              },
              headers: {
                'x-request-id': { required: true, schema: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        User: {
          type: 'object',
          required: ['id', 'name', 'email'],
          properties: {
            id: { type: 'integer' },
            name: { type: 'string', minLength: 1 },
            email: { type: 'string', pattern: '^[^@]+@[^@]+$' },
            role: { type: 'string', enum: ['admin', 'user', 'guest'] },
          },
        },
        CreateUser: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
          },
        },
      },
    },
    ...overrides,
  };
}

function createMockHandler(
  responses: Record<string, { status: number; body: unknown; headers?: Record<string, string> }>
): RequestHandler {
  return (req) => {
    const key = `${req.method} ${req.url}`;
    const match = responses[key];
    if (!match) {
      return {
        status: 404,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Not found' }),
      };
    }
    return {
      status: match.status,
      headers: { 'content-type': 'application/json', ...match.headers },
      body: JSON.stringify(match.body),
    };
  };
}

// ---- validateResponseSchema ----

describe('validateResponseSchema', () => {
  it('should validate a correct object against schema', () => {
    const schema: OpenApiSchema = {
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
    };
    const result = validateResponseSchema({ id: 1, name: 'Alice' }, schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should report missing required fields', () => {
    const schema: OpenApiSchema = {
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
    };
    const result = validateResponseSchema({ id: 1 }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('name'));
  });

  it('should report type mismatches', () => {
    const schema: OpenApiSchema = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
    };
    const result = validateResponseSchema({ id: 'not-a-number', name: 42 }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should validate enum values', () => {
    const schema: OpenApiSchema = {
      type: 'string',
      enum: ['admin', 'user', 'guest'],
    };
    expect(validateResponseSchema('admin', schema).valid).toBe(true);
    expect(validateResponseSchema('superadmin', schema).valid).toBe(false);
  });

  it('should validate string patterns', () => {
    const schema: OpenApiSchema = {
      type: 'string',
      pattern: '^[a-z]+@[a-z]+\\.[a-z]+$',
    };
    expect(validateResponseSchema('test@example.com', schema).valid).toBe(true);
    expect(validateResponseSchema('invalid-email', schema).valid).toBe(false);
  });

  it('should validate arrays with item schemas', () => {
    const schema: OpenApiSchema = {
      type: 'array',
      items: { type: 'integer' },
    };
    expect(validateResponseSchema([1, 2, 3], schema).valid).toBe(true);
    expect(validateResponseSchema([1, 'two', 3], schema).valid).toBe(false);
  });

  it('should resolve $ref schemas', () => {
    const schema: OpenApiSchema = { $ref: '#/components/schemas/User' };
    const schemas = {
      User: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer' } },
      },
    };
    expect(validateResponseSchema({ id: 1 }, schema, schemas).valid).toBe(true);
    expect(validateResponseSchema({ id: 'abc' }, schema, schemas).valid).toBe(false);
  });

  it('should validate string minLength and maxLength', () => {
    const schema: OpenApiSchema = { type: 'string', minLength: 2, maxLength: 5 };
    expect(validateResponseSchema('ab', schema).valid).toBe(true);
    expect(validateResponseSchema('a', schema).valid).toBe(false);
    expect(validateResponseSchema('abcdef', schema).valid).toBe(false);
  });

  it('should validate number minimum and maximum', () => {
    const schema: OpenApiSchema = { type: 'number', minimum: 0, maximum: 100 };
    expect(validateResponseSchema(50, schema).valid).toBe(true);
    expect(validateResponseSchema(-1, schema).valid).toBe(false);
    expect(validateResponseSchema(101, schema).valid).toBe(false);
  });
});

// ---- validateStatusCode ----

describe('validateStatusCode', () => {
  it('should return true when status is in expected list', () => {
    expect(validateStatusCode(200, [200, 201])).toBe(true);
  });

  it('should return false when status is not in expected list', () => {
    expect(validateStatusCode(404, [200, 201])).toBe(false);
  });
});

// ---- validateResponseHeaders ----

describe('validateResponseHeaders', () => {
  it('should pass when all required headers are present', () => {
    const result = validateResponseHeaders(
      { 'content-type': 'application/json', 'x-request-id': '123' },
      ['content-type', 'x-request-id']
    );
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('should report missing headers', () => {
    const result = validateResponseHeaders({ 'content-type': 'application/json' }, [
      'content-type',
      'x-request-id',
    ]);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('x-request-id');
  });

  it('should be case-insensitive for header names', () => {
    const result = validateResponseHeaders({ 'Content-Type': 'application/json' }, [
      'content-type',
    ]);
    expect(result.valid).toBe(true);
  });
});

// ---- parseOpenApiSpec ----

describe('parseOpenApiSpec', () => {
  it('should extract endpoints from paths', () => {
    const spec = createOpenApiSpec();
    const parsed = parseOpenApiSpec(spec);
    expect(parsed.endpoints).toHaveLength(2);
    expect(parsed.endpoints[0].path).toBe('/users');
    expect(parsed.endpoints[0].method).toBe('GET');
    expect(parsed.endpoints[1].method).toBe('POST');
  });

  it('should extract component schemas', () => {
    const spec = createOpenApiSpec();
    const parsed = parseOpenApiSpec(spec);
    expect(parsed.schemas).toHaveProperty('User');
    expect(parsed.schemas).toHaveProperty('CreateUser');
  });

  it('should extract response definitions', () => {
    const spec = createOpenApiSpec();
    const parsed = parseOpenApiSpec(spec);
    const getEndpoint = parsed.endpoints.find((e) => e.method === 'GET');
    expect(getEndpoint?.responses).toHaveProperty('200');
  });

  it('should extract requestBody when present', () => {
    const spec = createOpenApiSpec();
    const parsed = parseOpenApiSpec(spec);
    const postEndpoint = parsed.endpoints.find((e) => e.method === 'POST');
    expect(postEndpoint?.requestBody).toBeDefined();
    expect(postEndpoint?.requestBody?.required).toBe(true);
  });

  it('should handle empty paths gracefully', () => {
    const spec = { openapi: '3.0.3', info: { title: 'Empty', version: '1.0.0' }, paths: {} };
    const parsed = parseOpenApiSpec(spec);
    expect(parsed.endpoints).toHaveLength(0);
  });

  it('should handle missing paths key', () => {
    const spec = { openapi: '3.0.3', info: { title: 'No paths', version: '1.0.0' } };
    const parsed = parseOpenApiSpec(spec);
    expect(parsed.endpoints).toHaveLength(0);
  });
});

// ---- testContract ----

describe('testContract', () => {
  it('should pass when handler responses match the spec', async () => {
    const spec = createOpenApiSpec();
    const handler = createMockHandler({
      'GET /users': {
        status: 200,
        body: [{ id: 1, name: 'Alice', email: 'alice@test.com', role: 'admin' }],
      },
      'POST /users': {
        status: 201,
        body: { id: 2, name: 'Bob', email: 'bob@test.com', role: 'user' },
        headers: { 'x-request-id': 'req-123' },
      },
    });

    const result = await testContract(handler, spec);
    expect(result.passed).toBe(true);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.total).toBeGreaterThan(0);
  });

  it('should fail when status code does not match spec', async () => {
    const spec = createOpenApiSpec();
    const handler = createMockHandler({
      'GET /users': { status: 500, body: { error: 'Server error' } },
      'POST /users': {
        status: 201,
        body: { id: 1, name: 'A', email: 'a@b.com', role: 'user' },
        headers: { 'x-request-id': 'x' },
      },
    });

    const result = await testContract(handler, spec);
    expect(result.passed).toBe(false);
    const getResult = result.results.find((r) => r.method === 'GET');
    const statusCheck = getResult?.checks.find((c) => c.type === 'status');
    expect(statusCheck?.passed).toBe(false);
  });

  it('should fail when response body does not match schema', async () => {
    const spec = createOpenApiSpec();
    const handler = createMockHandler({
      'GET /users': {
        status: 200,
        body: [{ id: 'not-a-number', name: 123 }], // wrong types
      },
      'POST /users': {
        status: 201,
        body: { id: 1, name: 'A', email: 'a@b.com', role: 'user' },
        headers: { 'x-request-id': 'x' },
      },
    });

    const result = await testContract(handler, spec);
    expect(result.passed).toBe(false);
    const getResult = result.results.find((r) => r.method === 'GET');
    const schemaCheck = getResult?.checks.find((c) => c.type === 'schema');
    expect(schemaCheck?.passed).toBe(false);
  });

  it('should fail when required headers are missing', async () => {
    const spec = createOpenApiSpec();
    const handler = createMockHandler({
      'GET /users': {
        status: 200,
        body: [{ id: 1, name: 'Alice', email: 'alice@test.com' }],
      },
      'POST /users': {
        status: 201,
        body: { id: 2, name: 'Bob', email: 'bob@test.com' },
        // Missing x-request-id header
      },
    });

    const result = await testContract(handler, spec);
    expect(result.passed).toBe(false);
    const postResult = result.results.find((r) => r.method === 'POST');
    const headerCheck = postResult?.checks.find((c) => c.type === 'header');
    expect(headerCheck?.passed).toBe(false);
    expect(headerCheck?.message).toContain('x-request-id');
  });

  it('should filter endpoints by paths option', async () => {
    const spec = createOpenApiSpec();
    const handler = createMockHandler({
      'GET /users': {
        status: 200,
        body: [{ id: 1, name: 'Alice', email: 'alice@test.com' }],
      },
    });

    const result = await testContract(handler, spec, { paths: ['/users'] });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.every((r) => r.path === '/users')).toBe(true);
  });

  it('should filter endpoints by methods option', async () => {
    const spec = createOpenApiSpec();
    const handler = createMockHandler({
      'GET /users': {
        status: 200,
        body: [{ id: 1, name: 'Alice', email: 'alice@test.com' }],
      },
    });

    const result = await testContract(handler, spec, { methods: ['GET'] });
    expect(result.results.every((r) => r.method === 'GET')).toBe(true);
  });

  it('should handle handler errors gracefully', async () => {
    const spec = createOpenApiSpec();
    const handler: RequestHandler = () => {
      throw new Error('Connection refused');
    };

    const result = await testContract(handler, spec);
    expect(result.passed).toBe(false);
    expect(result.results[0].checks[0].message).toContain('Connection refused');
  });

  it('should provide correct summary counts', async () => {
    const spec = createOpenApiSpec();
    const handler = createMockHandler({
      'GET /users': {
        status: 200,
        body: [{ id: 1, name: 'Alice', email: 'alice@test.com' }],
      },
      'POST /users': {
        status: 201,
        body: { id: 2, name: 'Bob', email: 'bob@test.com' },
        headers: { 'x-request-id': 'req-123' },
      },
    });

    const result = await testContract(handler, spec);
    expect(result.summary.total).toBe(result.summary.passed + result.summary.failed);
  });
});
