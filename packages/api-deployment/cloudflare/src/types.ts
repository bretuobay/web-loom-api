/**
 * Cloudflare Workers deployment adapter types for Web Loom API Framework
 */

// ---------------------------------------------------------------------------
// Cloudflare Runtime Interfaces
// ---------------------------------------------------------------------------

/** Cloudflare KV Namespace interface */
export interface KVNamespace {
  get(key: string, options?: { type?: 'text' }): Promise<string | null>;
  get(key: string, options: { type: 'json' }): Promise<unknown | null>;
  get(key: string, options: { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>;
  get(key: string, options?: { type?: string }): Promise<unknown | null>;
  put(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: KVPutOptions
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: KVListOptions): Promise<KVListResult>;
}

/** KV put options */
export interface KVPutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: Record<string, unknown>;
}

/** KV list options */
export interface KVListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

/** KV list result */
export interface KVListResult {
  keys: Array<{ name: string; expiration?: number; metadata?: Record<string, unknown> }>;
  list_complete: boolean;
  cursor?: string;
}

/** Cloudflare D1 Database interface */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1ExecResult>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

/** D1 prepared statement */
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(): Promise<T[]>;
}

/** D1 query result */
export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    changes: number;
    last_row_id: number;
    served_by: string;
  };
}

/** D1 exec result */
export interface D1ExecResult {
  count: number;
  duration: number;
}

/** Cloudflare Durable Object Namespace */
export interface DurableObjectNamespace {
  newUniqueId(): DurableObjectId;
  idFromName(name: string): DurableObjectId;
  idFromString(hexId: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

/** Durable Object ID */
export interface DurableObjectId {
  toString(): string;
  equals(other: DurableObjectId): boolean;
}

/** Durable Object Stub */
export interface DurableObjectStub {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
}

/** Cloudflare AI binding interface */
export interface AiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Cloudflare Environment & Handler Types
// ---------------------------------------------------------------------------

/** Cloudflare Workers environment bindings */
export interface CloudflareEnv {
  [key: string]: unknown;
}

/** Cloudflare Workers execution context */
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/** Cloudflare handler options */
export interface CloudflareHandlerOptions {
  /** KV namespace binding name in wrangler.toml */
  kvNamespace?: string;
  /** D1 database binding name in wrangler.toml */
  d1Binding?: string;
  /** Durable Object namespace binding name */
  durableObjectNamespace?: string;
  /** AI binding name */
  aiBinding?: string;
}

/** Minimal Web Loom app interface for handler creation */
export interface WebLoomApp {
  handleRequest(request: Request): Promise<Response>;
}

/** Cache store interface for Web Loom framework */
export interface CacheStore {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
}

/** Workers fetch handler signature */
export type CloudflareFetchHandler = (
  request: Request,
  env: CloudflareEnv,
  ctx: ExecutionContext
) => Promise<Response>;

/** Workers AI text generation options */
export interface TextGenerationOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
}

/** Workers AI text generation result */
export interface TextGenerationResult {
  response: string;
}

/** Workers AI text embedding result */
export interface TextEmbeddingResult {
  data: number[][];
}

/** Workers AI image classification result */
export interface ImageClassificationResult {
  label: string;
  score: number;
}
