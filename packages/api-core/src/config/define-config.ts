/**
 * Configuration definition utilities
 * 
 * Provides helper functions for defining type-safe configurations
 * with IDE autocomplete and validation support.
 * 
 * @module config/define-config
 */

import type { WebLoomConfig } from './types';

/**
 * Defines a Web Loom API configuration with full type safety
 * 
 * This is a type-safe helper function that provides IDE autocomplete
 * and type checking for configuration objects. It's a simple identity
 * function that returns the config as-is, but with proper typing.
 * 
 * @param config - Configuration object
 * @returns The same configuration object with proper typing
 * 
 * @example
 * ```typescript
 * // webloom.config.ts
 * import { defineConfig } from '@web-loom/api-core';
 * 
 * export default defineConfig({
 *   adapters: {
 *     api: { package: '@web-loom/api-adapter-hono' },
 *     database: { package: '@web-loom/api-adapter-drizzle' },
 *     validation: { package: '@web-loom/api-adapter-zod' }
 *   },
 *   database: {
 *     url: '${DATABASE_URL}',
 *     poolSize: 10
 *   },
 *   security: {
 *     cors: {
 *       origins: ['https://app.example.com'],
 *       credentials: true
 *     }
 *   },
 *   features: {
 *     crud: true
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
export function defineConfig(config: WebLoomConfig): WebLoomConfig {
  return config;
}

/**
 * Creates a partial configuration that can be merged with other configs
 * 
 * Useful for creating reusable configuration presets or environment-specific
 * overrides that can be merged with a base configuration.
 * 
 * @param config - Partial configuration object
 * @returns The partial configuration with proper typing
 * 
 * @example
 * ```typescript
 * // config/base.ts
 * import { definePartialConfig } from '@web-loom/api-core';
 * 
 * export const baseConfig = definePartialConfig({
 *   adapters: {
 *     api: { package: '@web-loom/api-adapter-hono' },
 *     database: { package: '@web-loom/api-adapter-drizzle' },
 *     validation: { package: '@web-loom/api-adapter-zod' }
 *   },
 *   features: {
 *     crud: true
 *   }
 * });
 * 
 * // config/development.ts
 * export const devConfig = definePartialConfig({
 *   development: {
 *     hotReload: true,
 *     apiDocs: true,
 *     detailedErrors: true
 *   },
 *   observability: {
 *     logging: {
 *       level: 'debug',
 *       format: 'pretty'
 *     }
 *   }
 * });
 * 
 * // webloom.config.ts
 * import { mergeConfigs } from '@web-loom/api-core';
 * import { baseConfig } from './config/base';
 * import { devConfig } from './config/development';
 * 
 * export default mergeConfigs(baseConfig, devConfig, {
 *   database: {
 *     url: '${DATABASE_URL}'
 *   },
 *   security: {
 *     cors: {
 *       origins: ['*']
 *     }
 *   },
 *   observability: {
 *     logging: {
 *       level: 'debug'
 *     }
 *   }
 * });
 * ```
 */
export function definePartialConfig(
  config: Partial<WebLoomConfig>
): Partial<WebLoomConfig> {
  return config;
}

/**
 * Deep merges multiple configuration objects
 * 
 * Merges configurations from left to right, with later configs
 * overriding earlier ones. Arrays are replaced, not merged.
 * 
 * @param configs - Configuration objects to merge
 * @returns Merged configuration object
 * 
 * @example
 * ```typescript
 * const base = {
 *   database: { poolSize: 10 },
 *   security: { cors: { origins: ['*'] } }
 * };
 * 
 * const prod = {
 *   database: { poolSize: 20 },
 *   security: { cors: { origins: ['https://app.example.com'] } }
 * };
 * 
 * const merged = mergeConfigs(base, prod);
 * // => {
 * //   database: { poolSize: 20 },
 * //   security: { cors: { origins: ['https://app.example.com'] } }
 * // }
 * ```
 */
export function mergeConfigs(
  ...configs: Array<Partial<WebLoomConfig>>
): WebLoomConfig {
  return deepMerge({}, ...configs) as unknown as WebLoomConfig;
}

/**
 * Deep merges objects recursively
 * 
 * @internal
 */
function deepMerge(
  target: Record<string, unknown>,
  ...sources: Array<Partial<Record<string, unknown>>>
): Record<string, unknown> {
  if (sources.length === 0) {
    return target;
  }
  
  const source = sources[0];
  
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} });
        }
        deepMerge(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>
        );
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  
  return deepMerge(target, ...sources.slice(1));
}

/**
 * Checks if a value is a plain object
 * 
 * @internal
 */
function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Creates a configuration preset for common use cases
 * 
 * Provides pre-configured settings for typical deployment scenarios.
 * 
 * @param preset - Preset name
 * @returns Partial configuration for the preset
 * 
 * @example
 * ```typescript
 * import { defineConfig, createPreset } from '@web-loom/api-core';
 * 
 * export default defineConfig({
 *   ...createPreset('serverless'),
 *   database: {
 *     url: '${DATABASE_URL}'
 *   },
 *   security: {
 *     cors: {
 *       origins: ['https://app.example.com']
 *     }
 *   }
 * });
 * ```
 */
export function createPreset(
  preset: 'minimal' | 'serverless' | 'full-stack' | 'enterprise'
): Partial<WebLoomConfig> {
  switch (preset) {
    case 'minimal':
      return {
        features: {
          crud: true,
          graphql: false,
          websocket: false,
          caching: false,
          auditLogging: false,
        },
        observability: {
          logging: {
            level: 'info',
            format: 'json',
          },
        },
      };
    
    case 'serverless':
      return {
        features: {
          crud: true,
          graphql: false,
          websocket: false,
          caching: true,
          auditLogging: false,
        },
        observability: {
          logging: {
            level: 'info',
            format: 'json',
          },
        },
      };
    
    case 'full-stack':
      return {
        features: {
          crud: true,
          graphql: true,
          websocket: true,
          caching: true,
          auditLogging: false,
        },
        observability: {
          logging: {
            level: 'info',
            format: 'json',
          },
          metrics: {
            enabled: true,
            collectDefault: true,
          },
        },
        development: {
          hotReload: true,
          apiDocs: true,
          detailedErrors: true,
        },
      };
    
    case 'enterprise':
      return {
        security: {
          cors: {
            origins: [],
            credentials: true,
          },
          rateLimit: {
            limit: 1000,
            window: '1h',
          },
          requestSizeLimit: 10485760, // 10 MB
          securityHeaders: {
            hsts: {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
            },
            frameOptions: 'DENY',
            contentTypeOptions: 'nosniff',
          },
        },
        features: {
          crud: true,
          graphql: true,
          websocket: true,
          caching: true,
          auditLogging: true,
        },
        observability: {
          logging: {
            level: 'info',
            format: 'json',
            redact: ['password', 'token', 'apiKey', 'secret', 'creditCard'],
          },
          metrics: {
            enabled: true,
            collectDefault: true,
          },
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
