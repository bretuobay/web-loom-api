/**
 * Configuration loading with validation and environment variable support
 *
 * Provides a complete configuration loading pipeline:
 * 1. Load .env files with environment-specific overrides
 * 2. Load configuration file (webloom.config.ts)
 * 3. Interpolate environment variables
 * 4. Validate configuration
 * 5. Return typed, validated configuration
 *
 * @module config/load-config
 */

import type { WebLoomConfig } from './types';
import { loadEnvFiles, type EnvLoaderOptions } from './env-loader';
import { interpolateConfig } from './env-interpolation';
import { validateConfigOrThrow } from './validation';

/**
 * Options for loading configuration
 */
export interface LoadConfigOptions {
  /**
   * Configuration object or path to configuration file
   *
   * Can be:
   * - Configuration object directly
   * - Path to .ts/.js configuration file
   * - Omitted to use default path (webloom.config.ts)
   */
  config?: WebLoomConfig | string;

  /**
   * Environment file loading options
   */
  envOptions?: EnvLoaderOptions;

  /**
   * Whether to validate the configuration
   * @default true
   */
  validate?: boolean;

  /**
   * Whether to interpolate environment variables
   * @default true
   */
  interpolate?: boolean;
}

/**
 * Result of loading configuration
 */
export interface LoadConfigResult {
  /** Validated and typed configuration */
  config: WebLoomConfig;
  /** Environment files that were loaded */
  envFiles: string[];
  /** Environment variables that were parsed */
  envVars: Record<string, string>;
}

/**
 * Loads and validates configuration with full environment support
 *
 * This is the recommended way to load configuration at application startup.
 * It handles the complete pipeline:
 * 1. Loads .env files (base + environment-specific)
 * 2. Loads configuration from file or object
 * 3. Interpolates ${ENV_VAR} references
 * 4. Validates against schema
 * 5. Returns typed configuration
 *
 * @param options - Loading options
 * @returns Loaded and validated configuration
 * @throws {ConfigurationValidationError} If validation fails
 *
 * @example
 * ```typescript
 * // Load configuration with defaults
 * const { config } = loadConfig();
 *
 * // Load with custom environment
 * const { config } = loadConfig({
 *   envOptions: {
 *     environment: 'production',
 *     debug: true
 *   }
 * });
 *
 * // Load with custom config object
 * const { config } = loadConfig({
 *   config: myConfigObject
 * });
 * ```
 */
export function loadConfig(options: LoadConfigOptions = {}): LoadConfigResult {
  const { config: configInput, envOptions = {}, validate = true, interpolate = true } = options;

  // Step 1: Load environment files
  const envResult = loadEnvFiles(envOptions);

  // Step 2: Load configuration
  let config: WebLoomConfig;

  if (typeof configInput === 'string') {
    // Load from file path
    // Note: In a real implementation, this would use dynamic import
    // For now, we'll throw an error suggesting to pass the config object
    throw new Error(
      'Loading configuration from file path is not yet implemented. ' +
        'Please import your config file and pass it as an object.'
    );
  } else if (configInput) {
    // Use provided config object
    config = configInput;
  } else {
    // Try to load from default location
    throw new Error('No configuration provided. Please pass a config object or file path.');
  }

  // Step 3: Interpolate environment variables
  if (interpolate) {
    config = interpolateConfig(
      config as unknown as Record<string, unknown>
    ) as unknown as WebLoomConfig;
  }

  // Step 4: Validate configuration
  if (validate) {
    config = validateConfigOrThrow(config);
  }

  return {
    config,
    envFiles: envResult.loaded,
    envVars: envResult.parsed,
  };
}

/**
 * Loads configuration synchronously for startup
 *
 * Simplified version that loads config and terminates on error.
 * Suitable for application startup where you want to fail fast.
 *
 * @param config - Configuration object
 * @param envOptions - Environment loading options
 * @returns Validated configuration
 *
 * @example
 * ```typescript
 * import config from './webloom.config';
 *
 * const validConfig = loadConfigSync(config, {
 *   environment: process.env.NODE_ENV
 * });
 * ```
 */
export function loadConfigSync(
  config: WebLoomConfig,
  envOptions?: EnvLoaderOptions
): WebLoomConfig {
  const result = loadConfig({
    config,
    ...(envOptions ? { envOptions } : {}),
  });

  return result.config;
}
