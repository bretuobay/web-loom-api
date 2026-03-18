/**
 * Configuration validation using Zod
 * 
 * Provides runtime validation of configuration objects with detailed error messages.
 * Validates configuration at startup to catch errors early before the application runs.
 * 
 * @module config/validation
 */

import { z } from 'zod';
import type { WebLoomConfig } from './types';

/**
 * Validation error with detailed information about what went wrong
 */
export interface ValidationError {
  /** Field path where the error occurred (e.g., 'database.url') */
  path: string[];
  /** Human-readable error message */
  message: string;
  /** Error code for programmatic handling */
  code: string;
}

/**
 * Result of configuration validation
 */
export interface ValidationResult<T> {
  /** Whether validation succeeded */
  success: boolean;
  /** Validated and typed data (only present if success is true) */
  data?: T;
  /** Validation errors (only present if success is false) */
  errors?: ValidationError[];
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for database configuration
 */
const databaseConfigSchema = z.object({
  url: z.string().min(1, { message: 'Database URL is required' }),
  driver: z.enum(['neon-serverless', 'libsql', 'pg'], {
    errorMap: () => ({ message: 'database.driver must be one of: neon-serverless, libsql, pg' }),
  }),
  poolSize: z.number().int({ message: 'Pool size must be an integer' }).positive({ message: 'Pool size must be positive' }).optional(),
  connectionTimeout: z.number().int({ message: 'Connection timeout must be an integer' }).positive({ message: 'Connection timeout must be positive' }).optional(),
  ssl: z.boolean().optional(),
});

/**
 * Schema for CORS configuration
 */
const corsConfigSchema = z.object({
  origins: z.array(z.union([z.string(), z.instanceof(RegExp)])),
  credentials: z.boolean().optional(),
  methods: z.array(z.string()).optional(),
  headers: z.array(z.string()).optional(),
  exposedHeaders: z.array(z.string()).optional(),
  maxAge: z.number().int({ message: 'Max age must be an integer' }).positive({ message: 'Max age must be positive' }).optional(),
});

/**
 * Schema for rate limit configuration
 */
const rateLimitConfigSchema = z.object({
  limit: z.number().int({ message: 'Rate limit must be an integer' }).positive({ message: 'Rate limit must be a positive integer' }),
  window: z.string().regex(/^\d+[smhd]$/, { message: 'Window must be in format: 30s, 1m, 1h, 1d' }),
  keyGenerator: z.function().optional(),
  skipSuccessfulRequests: z.boolean().optional(),
  skipFailedRequests: z.boolean().optional(),
});

/**
 * Schema for security headers configuration
 */
const securityHeadersConfigSchema = z.object({
  contentSecurityPolicy: z.object({
    directives: z.record(z.string(), z.array(z.string())),
    reportUri: z.string().optional(),
  }).optional(),
  hsts: z.object({
    maxAge: z.number().int({ message: 'HSTS max age must be an integer' }).positive({ message: 'HSTS max age must be positive' }),
    includeSubDomains: z.boolean().optional(),
    preload: z.boolean().optional(),
  }).optional(),
  frameOptions: z.string().optional(),
  contentTypeOptions: z.literal('nosniff').optional(),
  xssProtection: z.string().optional(),
  referrerPolicy: z.string().optional(),
});

/**
 * Schema for security configuration
 */
const securityConfigSchema = z.object({
  cors: corsConfigSchema,
  rateLimit: rateLimitConfigSchema.optional(),
  requestSizeLimit: z.number().int({ message: 'Request size limit must be an integer' }).positive({ message: 'Request size limit must be positive' }).optional(),
  securityHeaders: securityHeadersConfigSchema.optional(),
});

/**
 * Schema for feature flags
 */
const featureFlagsSchema = z.object({
  crud: z.boolean().optional(),
  graphql: z.boolean().optional(),
  websocket: z.boolean().optional(),
  caching: z.boolean().optional(),
  auditLogging: z.boolean().optional(),
});

/**
 * Schema for logging configuration
 */
const loggingConfigSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']),
  format: z.enum(['json', 'pretty', 'text']).optional(),
  destination: z.enum(['stdout', 'stderr', 'file', 'http']).optional(),
  filePath: z.string().optional(),
  httpEndpoint: z.string().url().optional(),
  redact: z.array(z.string()).optional(),
});

/**
 * Schema for metrics configuration
 */
const metricsConfigSchema = z.object({
  enabled: z.boolean(),
  endpoint: z.string().optional(),
  collectDefault: z.boolean().optional(),
  prefix: z.string().optional(),
  labels: z.record(z.string(), z.string()).optional(),
});

/**
 * Schema for tracing configuration
 */
const tracingConfigSchema = z.object({
  enabled: z.boolean(),
  exporter: z.enum(['otlp', 'jaeger', 'zipkin']),
  endpoint: z.string().url({ message: 'Tracing endpoint must be a valid URL' }),
  serviceName: z.string().min(1, { message: 'Service name is required' }),
  sampleRate: z.number().min(0).max(1).optional(),
});

/**
 * Schema for observability configuration
 */
const observabilityConfigSchema = z.object({
  logging: loggingConfigSchema,
  metrics: metricsConfigSchema.optional(),
  tracing: tracingConfigSchema.optional(),
});

/**
 * Schema for development configuration
 */
const developmentConfigSchema = z.object({
  hotReload: z.boolean().optional(),
  apiDocs: z.boolean().optional(),
  detailedErrors: z.boolean().optional(),
  playground: z.boolean().optional(),
  mockData: z.boolean().optional(),
});

/**
 * Main configuration schema
 */
export const webLoomConfigSchema = z.object({
  database: databaseConfigSchema,
  routes: z.object({ dir: z.string().optional() }).optional(),
  openapi: z
    .object({
      enabled: z.boolean().optional(),
      ui: z.enum(['swagger', 'scalar']).optional(),
      title: z.string().optional(),
      version: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  security: securityConfigSchema.optional(),
  features: featureFlagsSchema.optional(),
  observability: observabilityConfigSchema.optional(),
  development: developmentConfigSchema.optional(),
});

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates a configuration object against the schema
 * 
 * Performs comprehensive validation of the configuration, checking:
 * - Required fields are present
 * - Field types are correct
 * - Values meet constraints (min, max, format, etc.)
 * - No unknown properties are present
 * 
 * @param config - Configuration object to validate
 * @returns Validation result with typed data or detailed errors
 * 
 * @example
 * ```typescript
 * const result = validateConfig(config);
 * 
 * if (result.success) {
 *   console.log('Configuration is valid:', result.data);
 * } else {
 *   console.error('Configuration errors:');
 *   result.errors?.forEach(err => {
 *     console.error(`  ${err.path.join('.')}: ${err.message}`);
 *   });
 * }
 * ```
 */
export function validateConfig(
  config: unknown
): ValidationResult<WebLoomConfig> {
  const result = webLoomConfigSchema.safeParse(config);

  if (result.success) {
    return {
      success: true,
      data: result.data as WebLoomConfig,
    };
  }

  // Format Zod errors into our ValidationError format
  const errors: ValidationError[] = result.error.issues.map((err) => ({
    path: err.path.map(String),
    message: err.message,
    code: err.code,
  }));

  return {
    success: false,
    errors,
  };
}

/**
 * Validates configuration and throws an error if invalid
 * 
 * This is a convenience function for startup validation where you want
 * the application to terminate immediately if the configuration is invalid.
 * 
 * @param config - Configuration object to validate
 * @returns Validated and typed configuration
 * @throws {ConfigurationValidationError} If validation fails
 * 
 * @example
 * ```typescript
 * try {
 *   const validConfig = validateConfigOrThrow(config);
 *   // Use validConfig...
 * } catch (error) {
 *   if (error instanceof ConfigurationValidationError) {
 *     console.error('Configuration validation failed:');
 *     error.errors.forEach(err => {
 *       console.error(`  ${err.path.join('.')}: ${err.message}`);
 *     });
 *     process.exit(1);
 *   }
 * }
 * ```
 */
export function validateConfigOrThrow(config: unknown): WebLoomConfig {
  const result = validateConfig(config);

  if (!result.success) {
    throw new ConfigurationValidationError(result.errors || []);
  }

  // Safe to assert non-null here because we checked result.success above
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return result.data!;
}

/**
 * Custom error class for configuration validation failures
 */
export class ConfigurationValidationError extends Error {
  constructor(public readonly errors: ValidationError[]) {
    const errorMessages = errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    super(
      `Configuration validation failed:\n${errorMessages}\n\n` +
        `Please check your webloom.config.ts file and fix the errors above.`
    );

    this.name = 'ConfigurationValidationError';
  }
}
