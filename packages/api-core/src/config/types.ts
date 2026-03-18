/**
 * Configuration schema and types for Web Loom API Framework
 *
 * The root type is `WebLoomConfig`. Pass a value to `defineConfig()` in
 * your `webloom.config.ts` to get type-checking and env-var resolution.
 *
 * @module config/types
 */

import type { EmailAdapter } from '../interfaces/email-adapter';

// ============================================================================
// Database
// ============================================================================

export type DrizzleDriver = 'neon-serverless' | 'libsql' | 'pg';

/**
 * Database connection configuration.
 *
 * The `driver` field controls which Drizzle adapter is loaded at runtime.
 * Install the corresponding package for your driver:
 *
 * | driver             | package                    |
 * |--------------------|----------------------------|
 * | neon-serverless    | `@neondatabase/serverless` |
 * | libsql             | `@libsql/client`           |
 * | pg                 | `pg`                       |
 */
export interface DatabaseConfig {
  /**
   * Database connection URL.
   *
   * Supports environment variable interpolation: `${DATABASE_URL}`
   * `defineConfig()` resolves these substitutions at startup and
   * throws a `ConfigurationError` if the env var is not set.
   */
  url: string;

  /**
   * Drizzle driver to use.
   *
   * - `neon-serverless` — Neon Postgres over HTTP; edge-safe
   * - `libsql`          — Turso or local SQLite via libsql
   * - `pg`              — Standard node-postgres (Docker / VMs)
   */
  driver: DrizzleDriver;

  /** Maximum connections in the pool (pg driver only, default: 10) */
  poolSize?: number;

  /** Connection timeout in milliseconds (pg driver only, default: 10000) */
  connectionTimeout?: number;

  /** Enable SSL/TLS (pg driver only, default: false) */
  ssl?: boolean;
}

// ============================================================================
// Routes
// ============================================================================

export interface RoutesConfig {
  /**
   * Directory to scan for route files.
   * @default './src/routes'
   */
  dir?: string;
}

// ============================================================================
// OpenAPI
// ============================================================================

export interface OpenApiConfig {
  /**
   * Enable `/openapi.json`, `/openapi.yaml`, and `/docs` routes.
   * @default true
   */
  enabled?: boolean;

  /**
   * UI library to serve at `/docs`.
   * @default 'swagger'
   */
  ui?: 'swagger' | 'scalar';

  /** API title shown in the docs UI */
  title?: string;

  /** API version string (e.g. '1.0.0') */
  version?: string;

  /** Longer description rendered in the docs UI */
  description?: string;
}

// ============================================================================
// Security
// ============================================================================

export interface CORSConfig {
  /**
   * Allowed origins.
   * Use `['*']` for development only — never in production with credentials.
   */
  origins: string[] | RegExp[];
  credentials?: boolean;
  methods?: string[];
  headers?: string[];
  exposedHeaders?: string[];
  /** Preflight cache max-age in seconds (default: 86400) */
  maxAge?: number;
}

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Time window: '30s', '1m', '1h', '1d' */
  window: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: {
    directives: Record<string, string[]>;
    reportUri?: string;
  };
  hsts?: {
    maxAge: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  frameOptions?: 'DENY' | 'SAMEORIGIN' | string;
  contentTypeOptions?: 'nosniff';
  xssProtection?: string;
  referrerPolicy?: string;
}

export interface SecurityConfig {
  cors: CORSConfig;
  rateLimit?: RateLimitConfig;
  /** Max request body size in bytes (default: 1 MB) */
  requestSizeLimit?: number;
  securityHeaders?: SecurityHeadersConfig;
}

// ============================================================================
// Feature flags
// ============================================================================

export interface FeatureFlags {
  /** Enable automatic CRUD route generation (default: true) */
  crud?: boolean;
  graphql?: boolean;
  websocket?: boolean;
  caching?: boolean;
  auditLogging?: boolean;
}

// ============================================================================
// Observability
// ============================================================================

export interface LoggingConfig {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  format?: 'json' | 'pretty' | 'text';
  destination?: 'stdout' | 'stderr' | 'file' | 'http';
  filePath?: string;
  httpEndpoint?: string;
  redact?: string[];
}

export interface MetricsConfig {
  enabled: boolean;
  endpoint?: string;
  collectDefault?: boolean;
  prefix?: string;
  labels?: Record<string, string>;
}

export interface TracingConfig {
  enabled: boolean;
  exporter: 'otlp' | 'jaeger' | 'zipkin';
  endpoint: string;
  serviceName: string;
  sampleRate?: number;
}

export interface ObservabilityConfig {
  logging: LoggingConfig;
  metrics?: MetricsConfig;
  tracing?: TracingConfig;
}

// ============================================================================
// Development
// ============================================================================

export interface DevelopmentConfig {
  hotReload?: boolean;
  apiDocs?: boolean;
  detailedErrors?: boolean;
  playground?: boolean;
  mockData?: boolean;
}

// ============================================================================
// Root configuration
// ============================================================================

/**
 * Complete Web Loom API Framework configuration.
 *
 * Define in `webloom.config.ts`:
 *
 * @example
 * ```typescript
 * import { defineConfig } from '@web-loom/api-core';
 *
 * export default defineConfig({
 *   database: {
 *     url: '${DATABASE_URL}',
 *     driver: 'neon-serverless',
 *   },
 *   routes: { dir: './src/routes' },
 *   openapi: { enabled: true, title: 'My API', version: '1.0.0' },
 * });
 * ```
 */
export interface WebLoomConfig {
  /** Database connection and driver settings (required) */
  database: DatabaseConfig;

  /** File-based routing configuration */
  routes?: RoutesConfig;

  /**
   * Email adapter instance (e.g. a ResendAdapter).
   *
   * When provided, it is injected into every request as `c.var.email`.
   * Accessing `c.var.email` without configuring an adapter throws a
   * `ConfigurationError` at the point of access.
   */
  email?: EmailAdapter;

  /** OpenAPI / docs endpoint configuration */
  openapi?: OpenApiConfig;

  /** CORS, rate limiting, and security headers */
  security?: SecurityConfig;

  /** Feature flags */
  features?: FeatureFlags;

  /** Logging, metrics, and tracing */
  observability?: ObservabilityConfig;

  /** Developer experience settings */
  development?: DevelopmentConfig;
}
