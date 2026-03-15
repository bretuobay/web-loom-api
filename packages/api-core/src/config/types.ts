/**
 * Configuration schema and types for Web Loom API Framework
 * 
 * This module defines the complete configuration structure for the framework,
 * including adapter selection, database settings, security configuration,
 * feature flags, observability settings, and development options.
 * 
 * All configuration supports environment variable interpolation using the
 * ${ENV_VAR} syntax, which is resolved at runtime.
 * 
 * @module config/types
 */

// ============================================================================
// Adapter Configuration
// ============================================================================

/**
 * Generic adapter configuration
 * 
 * Adapters are pluggable implementations of framework components.
 * Each adapter must specify a package name and can include custom options.
 * 
 * @example
 * ```typescript
 * const honoAdapter: AdapterConfig = {
 *   package: '@webloom/api-adapter-hono',
 *   options: {
 *     compression: true,
 *     poweredBy: false
 *   }
 * };
 * ```
 */
export interface AdapterConfig<TOptions = Record<string, unknown>> {
  /** NPM package name of the adapter (e.g., '@webloom/api-adapter-hono') */
  package: string;
  
  /** Adapter-specific configuration options */
  options?: TOptions;
}

/**
 * Collection of all adapter configurations
 * 
 * Specifies which adapter implementations to use for each framework component.
 * Auth and email adapters are optional and only loaded when needed.
 */
export interface AdaptersConfig {
  /** API framework adapter (e.g., Hono, Express, Fastify) */
  api: AdapterConfig;
  
  /** Database adapter (e.g., Drizzle, Prisma, Kysely) */
  database: AdapterConfig;
  
  /** Validation adapter (e.g., Zod, Yup, Joi) */
  validation: AdapterConfig;
  
  /** Authentication adapter (optional, e.g., Lucia, Auth.js) */
  auth?: AdapterConfig;
  
  /** Email service adapter (optional, e.g., Resend, SendGrid, AWS SES) */
  email?: AdapterConfig;
}

// ============================================================================
// Database Configuration
// ============================================================================

/**
 * Database connection and pooling configuration
 * 
 * Supports environment variable interpolation for sensitive values.
 * Connection pooling is optimized for serverless environments with
 * automatic connection reuse across invocations.
 * 
 * @example
 * ```typescript
 * const dbConfig: DatabaseConfig = {
 *   url: '${DATABASE_URL}',
 *   poolSize: 10,
 *   connectionTimeout: 10000,
 *   readReplicas: ['${READ_REPLICA_1}', '${READ_REPLICA_2}'],
 *   ssl: true
 * };
 * ```
 */
export interface DatabaseConfig {
  /**
   * Database connection URL
   * 
   * Supports environment variable interpolation: ${DATABASE_URL}
   * Format depends on database type:
   * - PostgreSQL: postgresql://user:pass@host:port/db
   * - MySQL: mysql://user:pass@host:port/db
   * - SQLite: file:./dev.db
   */
  url: string;
  
  /**
   * Maximum number of connections in the pool
   * 
   * @default 10
   * 
   * Recommendations:
   * - Serverless: 1-5 (minimize cold start overhead)
   * - Traditional server: 10-20 (balance throughput and resources)
   * - High traffic: 20-50 (requires adequate database resources)
   */
  poolSize?: number;
  
  /**
   * Connection timeout in milliseconds
   * 
   * @default 10000 (10 seconds)
   * 
   * Maximum time to wait for a connection from the pool.
   * Requests exceeding this timeout will fail with a connection error.
   */
  connectionTimeout?: number;
  
  /**
   * Read replica connection URLs for load distribution
   * 
   * When specified, read-only queries are distributed across replicas
   * using round-robin selection. Write operations always use the primary.
   * 
   * @example ['${READ_REPLICA_1}', '${READ_REPLICA_2}']
   */
  readReplicas?: string[];
  
  /**
   * Enable SSL/TLS for database connections
   * 
   * @default false
   * 
   * Required for most cloud database providers (Neon, PlanetScale, etc.)
   */
  ssl?: boolean;
}

// ============================================================================
// Security Configuration
// ============================================================================

/**
 * CORS (Cross-Origin Resource Sharing) configuration
 * 
 * Controls which origins can access your API from browsers.
 * Essential for frontend applications hosted on different domains.
 * 
 * @example
 * ```typescript
 * // Development: Allow all origins
 * const devCors: CORSConfig = {
 *   origins: ['*'],
 *   credentials: false
 * };
 * 
 * // Production: Whitelist specific origins
 * const prodCors: CORSConfig = {
 *   origins: ['https://app.example.com', 'https://admin.example.com'],
 *   credentials: true,
 *   methods: ['GET', 'POST', 'PUT', 'DELETE'],
 *   headers: ['Content-Type', 'Authorization'],
 *   maxAge: 86400
 * };
 * ```
 */
export interface CORSConfig {
  /**
   * Allowed origins for cross-origin requests
   * 
   * Can be:
   * - Array of exact origins: ['https://app.example.com']
   * - Wildcard for development: ['*']
   * - Regex patterns: [/^https:\/\/.*\.example\.com$/]
   * 
   * Security note: Never use '*' in production with credentials: true
   */
  origins: string[] | RegExp[];
  
  /**
   * Allow credentials (cookies, authorization headers) in CORS requests
   * 
   * @default false
   * 
   * When true, origins cannot be '*' for security reasons.
   * Required for session-based authentication from different origins.
   */
  credentials?: boolean;
  
  /**
   * Allowed HTTP methods for CORS requests
   * 
   * @default ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
   */
  methods?: string[];
  
  /**
   * Allowed request headers for CORS requests
   * 
   * @default ['Content-Type', 'Authorization']
   * 
   * Common headers to include:
   * - Content-Type: For JSON/form data
   * - Authorization: For bearer tokens
   * - X-Requested-With: For AJAX detection
   */
  headers?: string[];
  
  /**
   * Headers exposed to the browser in CORS responses
   * 
   * @default []
   * 
   * Browsers can only access these headers from cross-origin responses.
   * Useful for custom headers like X-Total-Count, X-RateLimit-Remaining.
   */
  exposedHeaders?: string[];
  
  /**
   * Maximum age (in seconds) for preflight cache
   * 
   * @default 86400 (24 hours)
   * 
   * Browsers cache preflight OPTIONS responses for this duration,
   * reducing the number of preflight requests.
   */
  maxAge?: number;
}

/**
 * Rate limiting configuration
 * 
 * Protects your API from abuse by limiting request rates per client.
 * Supports both IP-based and user-based rate limiting.
 * 
 * @example
 * ```typescript
 * // Basic rate limiting: 100 requests per minute per IP
 * const basicLimit: RateLimitConfig = {
 *   limit: 100,
 *   window: '1m'
 * };
 * 
 * // Advanced: Custom key generator for user-based limiting
 * const userLimit: RateLimitConfig = {
 *   limit: 1000,
 *   window: '1h',
 *   keyGenerator: (req) => req.user?.id || req.ip,
 *   skipSuccessfulRequests: false,
 *   skipFailedRequests: true
 * };
 * ```
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the time window
   * 
   * Recommendations:
   * - Public endpoints: 60-100 per minute
   * - Authenticated endpoints: 1000-5000 per hour
   * - Write operations: 10-50 per minute
   */
  limit: number;
  
  /**
   * Time window for rate limiting
   * 
   * Supported formats:
   * - Seconds: '30s', '60s'
   * - Minutes: '1m', '5m', '15m'
   * - Hours: '1h', '24h'
   * - Days: '1d', '7d'
   * 
   * @example '1m' for 1 minute, '1h' for 1 hour
   */
  window: string;
  
  /**
   * Custom function to generate rate limit keys
   * 
   * @default (req) => req.ip
   * 
   * Use cases:
   * - IP-based: (req) => req.ip
   * - User-based: (req) => req.user?.id || req.ip
   * - API key-based: (req) => req.headers['x-api-key'] || req.ip
   * - Combined: (req) => `${req.user?.id}:${req.path}`
   */
  keyGenerator?: (req: Request) => string;
  
  /**
   * Skip counting successful requests (2xx status codes)
   * 
   * @default false
   * 
   * When true, only failed requests count toward the limit.
   * Useful for protecting against brute force attacks.
   */
  skipSuccessfulRequests?: boolean;
  
  /**
   * Skip counting failed requests (4xx/5xx status codes)
   * 
   * @default false
   * 
   * When true, only successful requests count toward the limit.
   * Useful for preventing legitimate users from being blocked by errors.
   */
  skipFailedRequests?: boolean;
}

/**
 * Security headers configuration
 * 
 * Adds HTTP security headers to protect against common web vulnerabilities.
 * All headers are enabled by default with secure values.
 * 
 * @example
 * ```typescript
 * const securityHeaders: SecurityHeadersConfig = {
 *   contentSecurityPolicy: {
 *     directives: {
 *       defaultSrc: ["'self'"],
 *       scriptSrc: ["'self'", "'unsafe-inline'"],
 *       styleSrc: ["'self'", "'unsafe-inline'"],
 *       imgSrc: ["'self'", 'data:', 'https:'],
 *       connectSrc: ["'self'", 'https://api.example.com']
 *     }
 *   },
 *   hsts: {
 *     maxAge: 31536000,
 *     includeSubDomains: true,
 *     preload: true
 *   }
 * };
 * ```
 */
export interface SecurityHeadersConfig {
  /**
   * Content Security Policy (CSP) configuration
   * 
   * Prevents XSS attacks by controlling which resources can be loaded.
   * 
   * @default { directives: { defaultSrc: ["'self'"] } }
   */
  contentSecurityPolicy?: {
    /** CSP directives (e.g., defaultSrc, scriptSrc, styleSrc) */
    directives: Record<string, string[]>;
    /** Report CSP violations to this URL */
    reportUri?: string;
  };
  
  /**
   * HTTP Strict Transport Security (HSTS) configuration
   * 
   * Forces browsers to use HTTPS for all future requests.
   * 
   * @default { maxAge: 31536000, includeSubDomains: true }
   */
  hsts?: {
    /** Duration (in seconds) to enforce HTTPS */
    maxAge: number;
    /** Apply HSTS to all subdomains */
    includeSubDomains?: boolean;
    /** Submit domain to browser HSTS preload list */
    preload?: boolean;
  };
  
  /**
   * X-Frame-Options header value
   * 
   * Prevents clickjacking attacks by controlling iframe embedding.
   * 
   * @default 'DENY'
   * 
   * Options:
   * - DENY: Never allow framing
   * - SAMEORIGIN: Allow framing from same origin
   * - ALLOW-FROM uri: Allow framing from specific URI
   */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | string;
  
  /**
   * X-Content-Type-Options header value
   * 
   * Prevents MIME type sniffing.
   * 
   * @default 'nosniff'
   */
  contentTypeOptions?: 'nosniff';
  
  /**
   * X-XSS-Protection header value
   * 
   * Enables browser XSS filtering (legacy, CSP is preferred).
   * 
   * @default '1; mode=block'
   */
  xssProtection?: string;
  
  /**
   * Referrer-Policy header value
   * 
   * Controls how much referrer information is sent with requests.
   * 
   * @default 'strict-origin-when-cross-origin'
   */
  referrerPolicy?: string;
}

/**
 * Complete security configuration
 * 
 * Combines CORS, rate limiting, request size limits, and security headers.
 */
export interface SecurityConfig {
  /** CORS configuration for cross-origin requests */
  cors: CORSConfig;
  
  /** Rate limiting configuration (optional) */
  rateLimit?: RateLimitConfig;
  
  /**
   * Maximum request body size in bytes
   * 
   * @default 1048576 (1 MB)
   * 
   * Recommendations:
   * - JSON APIs: 1-10 MB
   * - File uploads: 10-100 MB
   * - Large data imports: 100+ MB
   */
  requestSizeLimit?: number;
  
  /** Security headers configuration (optional) */
  securityHeaders?: SecurityHeadersConfig;
}

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Feature flags for optional framework functionality
 * 
 * Enables or disables framework features to optimize bundle size
 * and runtime performance. All features are opt-in.
 * 
 * @example
 * ```typescript
 * const features: FeatureFlags = {
 *   crud: true,        // Enable automatic CRUD generation
 *   graphql: false,    // Disable GraphQL (not needed)
 *   websocket: false,  // Disable WebSocket (not needed)
 *   caching: true,     // Enable response caching
 *   auditLogging: true // Enable audit logs for compliance
 * };
 * ```
 */
export interface FeatureFlags {
  /**
   * Enable automatic CRUD route generation from models
   * 
   * @default true
   * 
   * When enabled, models with crud: true automatically get
   * POST, GET, PUT, PATCH, DELETE endpoints.
   */
  crud?: boolean;
  
  /**
   * Enable GraphQL API support
   * 
   * @default false
   * 
   * Generates GraphQL schema from models and provides
   * a GraphQL endpoint at /graphql.
   */
  graphql?: boolean;
  
  /**
   * Enable WebSocket support for real-time features
   * 
   * @default false
   * 
   * Adds WebSocket server for real-time subscriptions,
   * live updates, and bidirectional communication.
   */
  websocket?: boolean;
  
  /**
   * Enable response caching
   * 
   * @default false
   * 
   * Caches GET request responses to improve performance.
   * Supports in-memory and Redis backends.
   */
  caching?: boolean;
  
  /**
   * Enable audit logging for security-relevant events
   * 
   * @default false
   * 
   * Logs authentication attempts, authorization failures,
   * and data modifications for compliance and security monitoring.
   */
  auditLogging?: boolean;
}

// ============================================================================
// Observability Configuration
// ============================================================================

/**
 * Logging configuration
 * 
 * Controls log output format, level, and destinations.
 * Supports structured JSON logging for machine parsing.
 * 
 * @example
 * ```typescript
 * // Development: Human-readable logs
 * const devLogging: LoggingConfig = {
 *   level: 'debug',
 *   format: 'pretty',
 *   destination: 'stdout'
 * };
 * 
 * // Production: Structured JSON logs
 * const prodLogging: LoggingConfig = {
 *   level: 'info',
 *   format: 'json',
 *   destination: 'stdout',
 *   redact: ['password', 'token', 'apiKey', 'creditCard']
 * };
 * ```
 */
export interface LoggingConfig {
  /**
   * Minimum log level to output
   * 
   * @default 'info'
   * 
   * Levels (from most to least verbose):
   * - trace: Very detailed debugging information
   * - debug: Debugging information
   * - info: General informational messages
   * - warn: Warning messages for potential issues
   * - error: Error messages for failures
   * - fatal: Critical errors causing shutdown
   */
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  
  /**
   * Log output format
   * 
   * @default 'json'
   * 
   * Formats:
   * - json: Structured JSON for machine parsing
   * - pretty: Human-readable colored output (development)
   * - text: Plain text single-line format
   */
  format?: 'json' | 'pretty' | 'text';
  
  /**
   * Log destination
   * 
   * @default 'stdout'
   * 
   * Destinations:
   * - stdout: Standard output (console)
   * - stderr: Standard error
   * - file: Write to file (requires filePath)
   * - http: Send to HTTP endpoint (requires httpEndpoint)
   */
  destination?: 'stdout' | 'stderr' | 'file' | 'http';
  
  /**
   * File path for file destination
   * 
   * @example './logs/app.log'
   */
  filePath?: string;
  
  /**
   * HTTP endpoint for http destination
   * 
   * @example 'https://logs.example.com/ingest'
   */
  httpEndpoint?: string;
  
  /**
   * Fields to redact from logs (sensitive data)
   * 
   * @default ['password', 'token', 'apiKey', 'secret']
   * 
   * Redacted fields are replaced with '[REDACTED]' in log output.
   */
  redact?: string[];
}

/**
 * Metrics collection configuration
 * 
 * Collects performance metrics for monitoring and alerting.
 * Exposes metrics in Prometheus format at /metrics endpoint.
 * 
 * @example
 * ```typescript
 * const metrics: MetricsConfig = {
 *   enabled: true,
 *   endpoint: '/metrics',
 *   collectDefault: true,
 *   prefix: 'webloom_',
 *   labels: {
 *     service: 'api',
 *     environment: 'production'
 *   }
 * };
 * ```
 */
export interface MetricsConfig {
  /**
   * Enable metrics collection
   * 
   * @default false
   */
  enabled: boolean;
  
  /**
   * Endpoint to expose metrics
   * 
   * @default '/metrics'
   */
  endpoint?: string;
  
  /**
   * Collect default Node.js metrics (CPU, memory, event loop)
   * 
   * @default true
   */
  collectDefault?: boolean;
  
  /**
   * Prefix for all metric names
   * 
   * @default 'webloom_'
   * 
   * @example 'webloom_http_requests_total'
   */
  prefix?: string;
  
  /**
   * Default labels added to all metrics
   * 
   * @example { service: 'api', environment: 'production' }
   */
  labels?: Record<string, string>;
}

/**
 * Distributed tracing configuration
 * 
 * Enables distributed tracing for debugging performance issues
 * across services. Supports OpenTelemetry, Jaeger, and Zipkin.
 * 
 * @example
 * ```typescript
 * const tracing: TracingConfig = {
 *   enabled: true,
 *   exporter: 'otlp',
 *   endpoint: 'https://otel-collector.example.com',
 *   serviceName: 'api',
 *   sampleRate: 0.1
 * };
 * ```
 */
export interface TracingConfig {
  /**
   * Enable distributed tracing
   * 
   * @default false
   */
  enabled: boolean;
  
  /**
   * Tracing exporter type
   * 
   * Exporters:
   * - otlp: OpenTelemetry Protocol (recommended)
   * - jaeger: Jaeger tracing
   * - zipkin: Zipkin tracing
   */
  exporter: 'otlp' | 'jaeger' | 'zipkin';
  
  /**
   * Tracing backend endpoint
   * 
   * @example 'https://otel-collector.example.com'
   */
  endpoint: string;
  
  /**
   * Service name for trace identification
   * 
   * @example 'api'
   */
  serviceName: string;
  
  /**
   * Sampling rate (0.0 to 1.0)
   * 
   * @default 1.0 (trace all requests)
   * 
   * Recommendations:
   * - Development: 1.0 (trace everything)
   * - Production low traffic: 1.0
   * - Production high traffic: 0.01-0.1 (1-10%)
   */
  sampleRate?: number;
}

/**
 * Complete observability configuration
 * 
 * Combines logging, metrics, and tracing for comprehensive monitoring.
 */
export interface ObservabilityConfig {
  /** Logging configuration (required) */
  logging: LoggingConfig;
  
  /** Metrics collection configuration (optional) */
  metrics?: MetricsConfig;
  
  /** Distributed tracing configuration (optional) */
  tracing?: TracingConfig;
}

// ============================================================================
// Development Configuration
// ============================================================================

/**
 * Development-specific configuration
 * 
 * Features that enhance developer experience during development.
 * These settings are typically disabled in production.
 * 
 * @example
 * ```typescript
 * const development: DevelopmentConfig = {
 *   hotReload: true,
 *   apiDocs: true,
 *   detailedErrors: true,
 *   playground: true,
 *   mockData: true
 * };
 * ```
 */
export interface DevelopmentConfig {
  /**
   * Enable hot reload for routes and models
   * 
   * @default true
   * 
   * Watches for file changes and reloads affected modules
   * without restarting the server.
   */
  hotReload?: boolean;
  
  /**
   * Enable interactive API documentation
   * 
   * @default true
   * 
   * Serves OpenAPI documentation with Swagger UI or Scalar
   * at /docs endpoint.
   */
  apiDocs?: boolean;
  
  /**
   * Include detailed error messages and stack traces
   * 
   * @default true
   * 
   * Shows full error details in responses. Should be disabled
   * in production to avoid leaking sensitive information.
   */
  detailedErrors?: boolean;
  
  /**
   * Enable GraphQL playground (if GraphQL is enabled)
   * 
   * @default true
   * 
   * Provides interactive GraphQL IDE at /graphql endpoint.
   */
  playground?: boolean;
  
  /**
   * Enable mock data generation for testing
   * 
   * @default false
   * 
   * Generates fake data for models to facilitate frontend development
   * without a real database.
   */
  mockData?: boolean;
}

// ============================================================================
// Main Configuration Interface
// ============================================================================

/**
 * Complete Web Loom API Framework configuration
 * 
 * This is the root configuration object defined in webloom.config.ts.
 * All sections support environment variable interpolation using ${ENV_VAR} syntax.
 * 
 * @example
 * ```typescript
 * // webloom.config.ts
 * import { defineConfig } from '@webloom/api-core';
 * 
 * export default defineConfig({
 *   adapters: {
 *     api: { package: '@webloom/api-adapter-hono' },
 *     database: { package: '@webloom/api-adapter-drizzle' },
 *     validation: { package: '@webloom/api-adapter-zod' },
 *     auth: { package: '@webloom/api-adapter-lucia' }
 *   },
 *   database: {
 *     url: '${DATABASE_URL}',
 *     poolSize: 10,
 *     ssl: true
 *   },
 *   security: {
 *     cors: {
 *       origins: ['https://app.example.com'],
 *       credentials: true
 *     },
 *     rateLimit: {
 *       limit: 100,
 *       window: '1m'
 *     }
 *   },
 *   features: {
 *     crud: true,
 *     caching: true
 *   },
 *   observability: {
 *     logging: {
 *       level: 'info',
 *       format: 'json'
 *     }
 *   }
 * });
 * ```
 */
export interface WebLoomConfig {
  /**
   * Adapter selection and configuration
   * 
   * Specifies which adapter implementations to use for each framework component.
   * Auth and email adapters are optional.
   */
  adapters: AdaptersConfig;
  
  /**
   * Database connection and pooling configuration
   * 
   * Supports environment variable interpolation for sensitive values.
   */
  database: DatabaseConfig;
  
  /**
   * Security configuration (CORS, rate limiting, headers)
   * 
   * Essential for protecting your API from common web vulnerabilities.
   */
  security: SecurityConfig;
  
  /**
   * Feature flags for optional functionality
   * 
   * Enables or disables framework features to optimize bundle size.
   */
  features: FeatureFlags;
  
  /**
   * Observability configuration (logging, metrics, tracing)
   * 
   * Required for monitoring and debugging in production.
   */
  observability: ObservabilityConfig;
  
  /**
   * Development-specific configuration (optional)
   * 
   * Features that enhance developer experience during development.
   * Typically disabled in production.
   */
  development?: DevelopmentConfig;
}
