/**
 * Configuration definition utilities
 *
 * `defineConfig()` is the primary entry point for user configuration.
 * It resolves `${ENV_VAR}` interpolations in `database.url` and validates
 * that required fields are present.
 *
 * @module config/define-config
 */

import type { WebLoomConfig } from './types';
import { ConfigurationError } from '../errors/configuration-error';

export { ConfigurationError };

/**
 * Resolve `${ENV_VAR}` placeholders in a string.
 *
 * @throws {ConfigurationError} if a referenced env var is not set
 */
function resolveEnvVar(value: string, fieldPath: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName: string) => {
    const resolved = process.env[varName];
    if (resolved === undefined || resolved === '') {
      throw new ConfigurationError(
        `Environment variable "${varName}" required by ${fieldPath} is not set`
      );
    }
    return resolved;
  });
}

/**
 * Define a Web Loom API configuration with full type safety.
 *
 * Validates required fields and resolves `${ENV_VAR}` placeholders in
 * `database.url`. Call this in your `webloom.config.ts`:
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
 * });
 * ```
 *
 * @throws {ConfigurationError} if `database.url` is missing or an env var is unset
 */
export function defineConfig(config: WebLoomConfig): WebLoomConfig {
  if (!config.database?.url) {
    throw new ConfigurationError(
      'database.url is required. Set it in your webloom.config.ts or via the DATABASE_URL environment variable.'
    );
  }

  if (!config.database?.driver) {
    throw new ConfigurationError(
      'database.driver is required. Valid options: neon-serverless, libsql, pg'
    );
  }

  const resolvedUrl = resolveEnvVar(config.database.url, 'database.url');

  return {
    ...config,
    database: {
      ...config.database,
      url: resolvedUrl,
    },
  };
}

/**
 * Create a partial configuration that can be merged with other configs.
 *
 * Useful for environment-specific overrides:
 *
 * @example
 * ```typescript
 * const prodOverrides = definePartialConfig({
 *   observability: { logging: { level: 'warn', format: 'json' } },
 * });
 * ```
 */
export function definePartialConfig(config: Partial<WebLoomConfig>): Partial<WebLoomConfig> {
  return config;
}

/**
 * Deep-merge multiple partial configurations into one complete config.
 *
 * Later configs override earlier ones. Arrays are replaced, not merged.
 *
 * @example
 * ```typescript
 * export default mergeConfigs(baseConfig, envConfig, { database: { url: '...' } });
 * ```
 */
export function mergeConfigs(...configs: Array<Partial<WebLoomConfig>>): WebLoomConfig {
  return deepMerge({}, ...configs) as unknown as WebLoomConfig;
}

function deepMerge(
  target: Record<string, unknown>,
  ...sources: Array<Partial<Record<string, unknown>>>
): Record<string, unknown> {
  if (sources.length === 0) return target;

  const [source, ...rest] = sources;

  if (isPlainObject(target) && isPlainObject(source)) {
    for (const key of Object.keys(source)) {
      if (isPlainObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...rest);
}

function isPlainObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Create a pre-configured partial config for common deployment scenarios.
 */
export function createPreset(
  preset: 'minimal' | 'serverless' | 'full-stack' | 'enterprise'
): Partial<WebLoomConfig> {
  switch (preset) {
    case 'minimal':
      return { features: { crud: true } };

    case 'serverless':
      return {
        features: { crud: true, caching: true },
        observability: { logging: { level: 'info', format: 'json' } },
      };

    case 'full-stack':
      return {
        features: { crud: true, caching: true },
        observability: {
          logging: { level: 'info', format: 'json' },
          metrics: { enabled: true, collectDefault: true },
        },
        development: { hotReload: true, apiDocs: true, detailedErrors: true },
      };

    case 'enterprise':
      return {
        security: {
          cors: { origins: [], credentials: true },
          rateLimit: { limit: 1000, window: '1h' },
          requestSizeLimit: 10_485_760,
          securityHeaders: {
            hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
            frameOptions: 'DENY',
            contentTypeOptions: 'nosniff',
          },
        },
        features: { crud: true, caching: true, auditLogging: true },
        observability: {
          logging: {
            level: 'info',
            format: 'json',
            redact: ['password', 'token', 'apiKey', 'secret', 'creditCard'],
          },
          metrics: { enabled: true, collectDefault: true },
          tracing: {
            enabled: true,
            exporter: 'otlp',
            endpoint: '',
            serviceName: 'api',
            sampleRate: 0.1,
          },
        },
      };

    default:
      return {};
  }
}
