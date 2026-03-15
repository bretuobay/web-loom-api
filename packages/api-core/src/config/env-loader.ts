/**
 * Environment file loading with environment-specific overrides
 * 
 * Loads .env files with support for environment-specific overrides:
 * - .env (base configuration)
 * - .env.local (local overrides, not committed)
 * - .env.[environment] (environment-specific, e.g., .env.development)
 * - .env.[environment].local (environment-specific local overrides)
 * 
 * Files are loaded in order, with later files overriding earlier ones.
 * 
 * @module config/env-loader
 */

import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Options for loading environment files
 */
export interface EnvLoaderOptions {
  /**
   * Base directory to search for .env files
   * @default process.cwd()
   */
  cwd?: string;

  /**
   * Environment name (e.g., 'development', 'production', 'test')
   * @default process.env.NODE_ENV || 'development'
   */
  environment?: string;

  /**
   * Whether to override existing environment variables
   * @default false
   */
  override?: boolean;

  /**
   * Whether to log which files are loaded
   * @default false
   */
  debug?: boolean;
}

/**
 * Result of loading environment files
 */
export interface EnvLoaderResult {
  /** Files that were successfully loaded */
  loaded: string[];
  /** Files that were not found */
  notFound: string[];
  /** Environment variables that were set */
  parsed: Record<string, string>;
}

/**
 * Loads environment variables from .env files with environment-specific overrides
 * 
 * Loading order (later files override earlier ones):
 * 1. .env - Base configuration (committed to version control)
 * 2. .env.local - Local overrides (not committed, in .gitignore)
 * 3. .env.[environment] - Environment-specific (e.g., .env.development)
 * 4. .env.[environment].local - Environment-specific local overrides
 * 
 * @param options - Loading options
 * @returns Result with loaded files and parsed variables
 * 
 * @example
 * ```typescript
 * // Load environment files for development
 * const result = loadEnvFiles({
 *   environment: 'development',
 *   debug: true
 * });
 * 
 * console.log('Loaded files:', result.loaded);
 * console.log('Environment variables:', result.parsed);
 * ```
 */
export function loadEnvFiles(
  options: EnvLoaderOptions = {}
): EnvLoaderResult {
  const {
    cwd = process.cwd(),
    environment = process.env.NODE_ENV || 'development',
    override = false,
    debug = false,
  } = options;

  const loaded: string[] = [];
  const notFound: string[] = [];
  const parsed: Record<string, string> = {};

  // Define the order of .env files to load
  const envFiles = [
    '.env',
    '.env.local',
    `.env.${environment}`,
    `.env.${environment}.local`,
  ];

  // Load each file in order
  // Later files should override earlier ones, so we always use override: true
  for (const file of envFiles) {
    const filePath = resolve(cwd, file);

    if (existsSync(filePath)) {
      if (debug) {
        console.log(`[env-loader] Loading ${file}`);
      }

      const result = dotenvConfig({
        path: filePath,
        override: true, // Always override to allow later files to win
      });

      if (result.parsed) {
        Object.assign(parsed, result.parsed);
        loaded.push(file);
      }
    } else {
      notFound.push(file);
    }
  }

  if (debug) {
    console.log(`[env-loader] Loaded ${loaded.length} file(s):`, loaded);
    console.log(`[env-loader] Not found ${notFound.length} file(s):`, notFound);
  }

  return {
    loaded,
    notFound,
    parsed,
  };
}

/**
 * Loads environment files and returns a specific variable
 * 
 * Convenience function for loading env files and immediately accessing a variable.
 * 
 * @param key - Environment variable key
 * @param options - Loading options
 * @returns Value of the environment variable, or undefined if not found
 * 
 * @example
 * ```typescript
 * const databaseUrl = loadEnvVar('DATABASE_URL', {
 *   environment: 'production'
 * });
 * ```
 */
export function loadEnvVar(
  key: string,
  options: EnvLoaderOptions = {}
): string | undefined {
  loadEnvFiles(options);
  return process.env[key];
}

/**
 * Loads environment files and returns multiple variables
 * 
 * @param keys - Array of environment variable keys
 * @param options - Loading options
 * @returns Object with requested environment variables
 * 
 * @example
 * ```typescript
 * const { DATABASE_URL, API_KEY } = loadEnvVars(
 *   ['DATABASE_URL', 'API_KEY'],
 *   { environment: 'production' }
 * );
 * ```
 */
export function loadEnvVars(
  keys: string[],
  options: EnvLoaderOptions = {}
): Record<string, string | undefined> {
  loadEnvFiles(options);

  const result: Record<string, string | undefined> = {};
  for (const key of keys) {
    result[key] = process.env[key];
  }

  return result;
}
