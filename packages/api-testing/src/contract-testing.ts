/**
 * Contract testing utilities for validating API responses against OpenAPI specs.
 */
import type { RequestHandler, TestResponseData } from './types';

// ---- Types ----

export interface ContractTestOptions {
  paths?: string[];
  methods?: string[];
  validateRequestBody?: boolean;
  validateResponseBody?: boolean;
  validateHeaders?: boolean;
  validateStatusCodes?: boolean;
}

export interface ContractTestResult {
  passed: boolean;
  results: ContractCheckResult[];
  summary: { total: number; passed: number; failed: number };
}

export interface ContractCheckResult {
  path: string;
  method: string;
  checks: ContractCheck[];
}

export interface ContractCheck {
  type: 'status' | 'schema' | 'header' | 'content-type';
  passed: boolean;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

export interface ParsedEndpoint {
  path: string;
  method: string;
  responses: Record<string, ParsedResponse>;
  requestBody?: { required?: boolean; content?: Record<string, { schema?: OpenApiSchema }> };
}

export interface ParsedResponse {
  description?: string;
  headers?: Record<string, { required?: boolean; schema?: OpenApiSchema }>;
  content?: Record<string, { schema?: OpenApiSchema }>;
}


export interface ParsedSpec {
  endpoints: ParsedEndpoint[];
  schemas: Record<string, OpenApiSchema>;
}

export interface OpenApiSchema {
  type?: string;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  items?: OpenApiSchema;
  enum?: unknown[];
  pattern?: string;
  format?: string;
  $ref?: string;
  allOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  additionalProperties?: boolean | OpenApiSchema;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenApiSpec = Record<string, any>;

// ---- Schema Validation ----

export function validateResponseSchema(
  response: unknown,
  schema: OpenApiSchema,
  schemas?: Record<string, OpenApiSchema>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  validateValue(response, schema, '', errors, schemas ?? {});
  return { valid: errors.length === 0, errors };
}

function resolveSchema(
  schema: OpenApiSchema,
  schemas: Record<string, OpenApiSchema>
): OpenApiSchema {
  if (schema.$ref) {
    const refName = schema.$ref.replace('#/components/schemas/', '');
    const resolved = schemas[refName];
    if (!resolved) {
      return schema;
    }
    return resolved;
  }
  return schema;
}

function validateValue(
  value: unknown,
  schema: OpenApiSchema,
  path: string,
  errors: string[],
  schemas: Record<string, OpenApiSchema>
): void {
  const resolved = resolveSchema(schema, schemas);

  // Handle allOf
  if (resolved.allOf) {
    for (const sub of resolved.allOf) {
      validateValue(value, sub, path, errors, schemas);
    }
    return;
  }

  // Handle oneOf
  if (resolved.oneOf) {
    const subErrors: string[][] = [];
    let matchCount = 0;
    for (const sub of resolved.oneOf) {
      const subErr: string[] = [];
      validateValue(value, sub, path, subErr, schemas);
      subErrors.push(subErr);
      if (subErr.length === 0) matchCount++;
    }
    if (matchCount === 0) {
      errors.push(`${path || 'value'}: does not match any oneOf schemas`);
    }
    return;
  }

  // Handle anyOf
  if (resolved.anyOf) {
    const matched = resolved.anyOf.some((sub) => {
      const subErr: string[] = [];
      validateValue(value, sub, path, subErr, schemas);
      return subErr.length === 0;
    });
    if (!matched) {
      errors.push(`${path || 'value'}: does not match any anyOf schemas`);
    }
    return;
  }

  if (value === null || value === undefined) {
    if (resolved.type && resolved.type !== 'null') {
      errors.push(`${path || 'value'}: expected type "${resolved.type}", got ${value}`);
    }
    return;
  }

  // Type checking
  if (resolved.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (resolved.type === 'integer') {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        errors.push(`${path || 'value'}: expected integer, got ${typeof value} (${value})`);
        return;
      }
    } else if (actualType !== resolved.type) {
      errors.push(`${path || 'value'}: expected type "${resolved.type}", got "${actualType}"`);
      return;
    }
  }


  // Enum validation
  if (resolved.enum) {
    if (!resolved.enum.includes(value)) {
      errors.push(
        `${path || 'value'}: value ${JSON.stringify(value)} not in enum [${resolved.enum.map((e) => JSON.stringify(e)).join(', ')}]`
      );
    }
  }

  // Pattern validation
  if (resolved.pattern && typeof value === 'string') {
    if (!new RegExp(resolved.pattern).test(value)) {
      errors.push(`${path || 'value'}: value "${value}" does not match pattern "${resolved.pattern}"`);
    }
  }

  // String length validation
  if (typeof value === 'string') {
    if (resolved.minLength !== undefined && value.length < resolved.minLength) {
      errors.push(`${path || 'value'}: string length ${value.length} is less than minLength ${resolved.minLength}`);
    }
    if (resolved.maxLength !== undefined && value.length > resolved.maxLength) {
      errors.push(`${path || 'value'}: string length ${value.length} exceeds maxLength ${resolved.maxLength}`);
    }
  }

  // Number range validation
  if (typeof value === 'number') {
    if (resolved.minimum !== undefined && value < resolved.minimum) {
      errors.push(`${path || 'value'}: value ${value} is less than minimum ${resolved.minimum}`);
    }
    if (resolved.maximum !== undefined && value > resolved.maximum) {
      errors.push(`${path || 'value'}: value ${value} exceeds maximum ${resolved.maximum}`);
    }
  }

  // Object validation
  if (resolved.type === 'object' && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;

    // Required fields
    if (resolved.required) {
      for (const field of resolved.required) {
        if (!(field in obj)) {
          errors.push(`${path ? path + '.' : ''}${field}: required field is missing`);
        }
      }
    }

    // Property validation
    if (resolved.properties) {
      for (const [key, propSchema] of Object.entries(resolved.properties)) {
        if (key in obj) {
          validateValue(obj[key], propSchema, path ? `${path}.${key}` : key, errors, schemas);
        }
      }
    }
  }

  // Array validation
  if (resolved.type === 'array' && Array.isArray(value) && resolved.items) {
    for (let i = 0; i < value.length; i++) {
      validateValue(value[i], resolved.items, `${path || 'value'}[${i}]`, errors, schemas);
    }
  }
}

// ---- Status Code & Header Validation ----

export function validateStatusCode(actual: number, expected: number[]): boolean {
  return expected.includes(actual);
}

export function validateResponseHeaders(
  headers: Record<string, string>,
  requiredHeaders: string[]
): { valid: boolean; missing: string[] } {
  const normalizedHeaders = Object.keys(headers).map((h) => h.toLowerCase());
  const missing = requiredHeaders.filter(
    (h) => !normalizedHeaders.includes(h.toLowerCase())
  );
  return { valid: missing.length === 0, missing };
}


// ---- OpenAPI Spec Parsing ----

export function parseOpenApiSpec(spec: OpenApiSpec): ParsedSpec {
  const endpoints: ParsedEndpoint[] = [];
  const schemas: Record<string, OpenApiSchema> = {};

  // Extract component schemas
  if (spec.components?.schemas) {
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      schemas[name] = schema as OpenApiSchema;
    }
  }

  // Extract endpoints from paths
  const paths = spec.paths ?? {};
  const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

  for (const [pathStr, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    const pathObj = pathItem as Record<string, unknown>;

    for (const method of httpMethods) {
      const operation = pathObj[method];
      if (!operation || typeof operation !== 'object') continue;
      const op = operation as Record<string, unknown>;

      const responses: Record<string, ParsedResponse> = {};
      if (op.responses && typeof op.responses === 'object') {
        for (const [statusCode, responseObj] of Object.entries(
          op.responses as Record<string, unknown>
        )) {
          if (responseObj && typeof responseObj === 'object') {
            responses[statusCode] = responseObj as ParsedResponse;
          }
        }
      }

      const endpoint: ParsedEndpoint = {
        path: pathStr,
        method: method.toUpperCase(),
        responses,
      };

      if (op.requestBody && typeof op.requestBody === 'object') {
        endpoint.requestBody = op.requestBody as ParsedEndpoint['requestBody'];
      }

      endpoints.push(endpoint);
    }
  }

  return { endpoints, schemas };
}

// ---- Contract Testing ----

export async function testContract(
  handler: RequestHandler,
  openApiSpec: OpenApiSpec,
  options?: ContractTestOptions
): Promise<ContractTestResult> {
  const parsed = parseOpenApiSpec(openApiSpec);
  const results: ContractCheckResult[] = [];

  const opts: Required<ContractTestOptions> = {
    paths: options?.paths ?? [],
    methods: options?.methods ?? [],
    validateRequestBody: options?.validateRequestBody ?? false,
    validateResponseBody: options?.validateResponseBody ?? true,
    validateHeaders: options?.validateHeaders ?? true,
    validateStatusCodes: options?.validateStatusCodes ?? true,
  };

  let endpoints = parsed.endpoints;

  // Filter by paths if specified
  if (opts.paths.length > 0) {
    endpoints = endpoints.filter((e) => opts.paths.includes(e.path));
  }

  // Filter by methods if specified
  if (opts.methods.length > 0) {
    const upperMethods = opts.methods.map((m) => m.toUpperCase());
    endpoints = endpoints.filter((e) => upperMethods.includes(e.method));
  }

  for (const endpoint of endpoints) {
    const checks: ContractCheck[] = [];

    // Make a request to the endpoint
    let response: TestResponseData;
    try {
      response = await handler({
        method: endpoint.method,
        url: endpoint.path,
        headers: { 'content-type': 'application/json' },
      });
    } catch (err) {
      checks.push({
        type: 'status',
        passed: false,
        message: `Request to ${endpoint.method} ${endpoint.path} failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      results.push({ path: endpoint.path, method: endpoint.method, checks });
      continue;
    }

    // Validate status codes
    if (opts.validateStatusCodes) {
      const expectedCodes = Object.keys(endpoint.responses).map((code) =>
        code === 'default' ? response.status : parseInt(code, 10)
      );

      if (expectedCodes.length > 0) {
        const statusValid = validateStatusCode(response.status, expectedCodes);
        checks.push({
          type: 'status',
          passed: statusValid,
          message: statusValid
            ? `Status ${response.status} matches expected codes [${expectedCodes.join(', ')}]`
            : `Status ${response.status} not in expected codes [${expectedCodes.join(', ')}]`,
          expected: expectedCodes,
          actual: response.status,
        });
      }
    }


    // Find the matching response spec for the actual status code
    const statusStr = String(response.status);
    const responseSpec =
      endpoint.responses[statusStr] ?? endpoint.responses['default'];

    if (responseSpec) {
      // Validate content-type header
      if (responseSpec.content) {
        const expectedContentTypes = Object.keys(responseSpec.content);
        const actualContentType = response.headers['content-type']?.split(';')[0]?.trim();

        if (expectedContentTypes.length > 0 && actualContentType) {
          const ctValid = expectedContentTypes.includes(actualContentType);
          checks.push({
            type: 'content-type',
            passed: ctValid,
            message: ctValid
              ? `Content-Type "${actualContentType}" matches expected types`
              : `Content-Type "${actualContentType}" not in expected [${expectedContentTypes.join(', ')}]`,
            expected: expectedContentTypes,
            actual: actualContentType,
          });
        }
      }

      // Validate response body schema
      if (opts.validateResponseBody && responseSpec.content) {
        const actualContentType = response.headers['content-type']?.split(';')[0]?.trim();
        const contentSpec = actualContentType
          ? responseSpec.content[actualContentType]
          : Object.values(responseSpec.content)[0];

        if (contentSpec?.schema && response.body) {
          let parsedBody: unknown;
          try {
            parsedBody = JSON.parse(response.body);
          } catch {
            parsedBody = response.body;
          }

          const schemaResult = validateResponseSchema(
            parsedBody,
            contentSpec.schema,
            parsed.schemas
          );
          checks.push({
            type: 'schema',
            passed: schemaResult.valid,
            message: schemaResult.valid
              ? `Response body matches schema`
              : `Schema validation failed: ${schemaResult.errors.join('; ')}`,
          });
        }
      }

      // Validate required headers
      if (opts.validateHeaders && responseSpec.headers) {
        const requiredHeaders = Object.entries(responseSpec.headers)
          .filter(([, spec]) => spec.required)
          .map(([name]) => name);

        if (requiredHeaders.length > 0) {
          const headerResult = validateResponseHeaders(
            response.headers,
            requiredHeaders
          );
          checks.push({
            type: 'header',
            passed: headerResult.valid,
            message: headerResult.valid
              ? `All required headers present`
              : `Missing required headers: ${headerResult.missing.join(', ')}`,
            expected: requiredHeaders,
            actual: Object.keys(response.headers),
          });
        }
      }
    }

    results.push({ path: endpoint.path, method: endpoint.method, checks });
  }

  const totalChecks = results.reduce((sum, r) => sum + r.checks.length, 0);
  const passedChecks = results.reduce(
    (sum, r) => sum + r.checks.filter((c) => c.passed).length,
    0
  );

  return {
    passed: totalChecks > 0 && passedChecks === totalChecks,
    results,
    summary: {
      total: totalChecks,
      passed: passedChecks,
      failed: totalChecks - passedChecks,
    },
  };
}
