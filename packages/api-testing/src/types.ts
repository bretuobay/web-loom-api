/**
 * Testing types for @web-loom/api-testing
 */

// ---- Test Client Types ----

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  timeout?: number;
}

export interface TestResponseData {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface TestResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  json<T = unknown>(): T;
  expectStatus(code: number): TestResponse;
  expectHeader(name: string, value: string): TestResponse;
  expectBodyContains(text: string): TestResponse;
  expectJsonMatch(partial: Record<string, unknown>): TestResponse;
  expectSchema(schema: SchemaValidator): TestResponse;
}

export type SchemaValidator = {
  validate(data: unknown): { success: boolean; errors?: string[] };
};

export type RequestInterceptor = (req: {
  method: HttpMethod;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
}) => void | Promise<void>;

export type ResponseInterceptor = (res: TestResponseData) => void | Promise<void>;

export type RequestHandler = (req: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}) => Promise<TestResponseData> | TestResponseData;
