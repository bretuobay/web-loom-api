/**
 * @web-loom/api-testing - Testing utilities for Web Loom API Framework
 */

// Types
export type {
  HttpMethod,
  RequestHandler,
  RequestInterceptor,
  RequestOptions,
  ResponseInterceptor,
  SchemaValidator,
  TestResponse,
  TestResponseData,
} from './types';

// Test Client
export { TestClient } from './test-client';

// Factory & Seeding
export {
  defineFactory,
  seed,
  randomString,
  randomInt,
  randomEmail,
  randomDate,
  randomUUID,
  sequence,
  resetSequence,
} from './factory';
export type { Factory, FactoryAttrs } from './factory';

// Mock Database
export { createMockDatabase } from './mock-database';
export type { MockDatabase, QueryRecord, QueryHandler } from './mock-database';

// Mock Auth
export { createMockAuth } from './mock-auth';
export type { MockAuth, MockUser, MockSession } from './mock-auth';

// Mock Email
export { createMockEmail } from './mock-email';
export type { MockEmail, EmailMessage, SendEmailOptions } from './mock-email';

// Benchmarking
export {
  benchmark,
  benchmarkColdStart,
  benchmarkLatency,
  benchmarkThroughput,
  formatBenchmarkReport,
} from './benchmark';
export type {
  BenchmarkOptions,
  BenchmarkResult,
  ColdStartResult,
  LatencyResult,
  BenchmarkRequest,
  ThroughputOptions,
  ThroughputResult,
} from './benchmark';

// Contract Testing
export {
  testContract,
  validateResponseSchema,
  validateStatusCode,
  validateResponseHeaders,
  parseOpenApiSpec,
} from './contract-testing';
export type {
  ContractTestOptions,
  ContractTestResult,
  ContractCheckResult,
  ContractCheck,
  ParsedEndpoint,
  ParsedResponse,
  ParsedSpec,
  OpenApiSchema,
} from './contract-testing';

// Model Serializer
export { serialize, deserialize, validateDeserialized, ValidationError } from './model-serializer';
export type { ModelSchema, FieldDef, FieldType } from './model-serializer';
