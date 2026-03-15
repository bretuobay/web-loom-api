/**
 * Environment variable interpolation utilities
 * 
 * Provides functionality to resolve environment variable references in configuration
 * values using the ${ENV_VAR} syntax. Supports nested objects and arrays.
 * 
 * @module config/env-interpolation
 */

import { ConfigurationError } from '@webloom/api-shared';

/**
 * Regular expression to match environment variable references
 * 
 * Matches patterns like:
 * - ${VAR_NAME}
 * - ${VAR_NAME:-default_value}
 * 
 * Capture groups:
 * 1. Variable name
 * 2. Default value (optional, after :-)
 */
const ENV_VAR_PATTERN = /\$\{([A-Z_][A-Z0-9_]*?)(?::-(.*?))?\}/g;

/**
 * Options for environment variable interpolation
 */
export interface InterpolationOptions {
  /**
   * Whether to throw an error if a referenced environment variable is not defined
   * 
   * @default true
   * 
   * When false, undefined variables are replaced with empty strings.
   */
  strict?: boolean;
  
  /**
   * Custom environment variable source
   * 
   * @default process.env
   * 
   * Useful for testing or custom environment variable providers.
   */
  env?: Record<string, string | undefined>;
}

/**
 * Interpolates environment variables in a string value
 * 
 * Replaces ${ENV_VAR} patterns with actual environment variable values.
 * Supports default values using ${ENV_VAR:-default} syntax.
 * 
 * @param value - String value potentially containing environment variable references
 * @param options - Interpolation options
 * @returns String with environment variables resolved
 * @throws {ConfigurationError} If strict mode is enabled and a variable is undefined
 * 
 * @example
 * ```typescript
 * // Basic interpolation
 * interpolateString('postgresql://${DB_USER}:${DB_PASS}@localhost/mydb')
 * // => 'postgresql://admin:secret@localhost/mydb'
 * 
 * // With default value
 * interpolateString('${PORT:-3000}')
 * // => '3000' (if PORT is not set)
 * 
 * // Multiple variables
 * interpolateString('${PROTOCOL}://${HOST}:${PORT}')
 * // => 'https://api.example.com:443'
 * ```
 */
export function interpolateString(
  value: string,
  options: InterpolationOptions = {}
): string {
  const { strict = true, env = process.env } = options;
  
  return value.replace(ENV_VAR_PATTERN, (_match, varName, defaultValue) => {
    const envValue = env[varName];
    
    // If variable is defined, use it
    if (envValue !== undefined) {
      return envValue;
    }
    
    // If default value is provided, use it
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    
    // If strict mode, throw error
    if (strict) {
      throw new ConfigurationError(
        `Environment variable ${varName} is not defined and no default value was provided. ` +
        `Either set the ${varName} environment variable or provide a default value using ` +
        `\${${varName}:-default_value} syntax.`
      );
    }
    
    // In non-strict mode, return empty string
    return '';
  });
}

/**
 * Interpolates environment variables in any value type
 * 
 * Recursively processes objects and arrays, interpolating strings
 * while preserving other types (numbers, booleans, null, etc.).
 * 
 * @param value - Value to interpolate (can be any type)
 * @param options - Interpolation options
 * @returns Value with environment variables resolved
 * 
 * @example
 * ```typescript
 * const config = {
 *   database: {
 *     url: '${DATABASE_URL}',
 *     poolSize: 10,
 *     ssl: true
 *   },
 *   replicas: ['${REPLICA_1}', '${REPLICA_2}']
 * };
 * 
 * const interpolated = interpolateValue(config);
 * // => {
 * //   database: {
 * //     url: 'postgresql://...',
 * //     poolSize: 10,
 * //     ssl: true
 * //   },
 * //   replicas: ['postgresql://replica1...', 'postgresql://replica2...']
 * // }
 * ```
 */
export function interpolateValue<T>(
  value: T,
  options: InterpolationOptions = {}
): T {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return value;
  }
  
  // Handle strings - perform interpolation
  if (typeof value === 'string') {
    return interpolateString(value, options) as T;
  }
  
  // Handle arrays - recursively interpolate each element
  if (Array.isArray(value)) {
    return value.map(item => interpolateValue(item, options)) as T;
  }
  
  // Handle objects - recursively interpolate each property
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    
    for (const [key, val] of Object.entries(value)) {
      result[key] = interpolateValue(val, options);
    }
    
    return result as T;
  }
  
  // For other types (number, boolean, etc.), return as-is
  return value;
}

/**
 * Interpolates environment variables in a configuration object
 * 
 * This is the main entry point for configuration interpolation.
 * Processes the entire configuration object recursively.
 * 
 * @param config - Configuration object to interpolate
 * @param options - Interpolation options
 * @returns Configuration with environment variables resolved
 * @throws {ConfigurationError} If strict mode is enabled and a variable is undefined
 * 
 * @example
 * ```typescript
 * import { interpolateConfig } from '@webloom/api-core';
 * 
 * const config = {
 *   database: {
 *     url: '${DATABASE_URL}',
 *     poolSize: 10
 *   },
 *   security: {
 *     cors: {
 *       origins: ['${FRONTEND_URL}']
 *     }
 *   }
 * };
 * 
 * const interpolated = interpolateConfig(config);
 * // All ${...} references are now resolved
 * ```
 */
export function interpolateConfig<T extends Record<string, unknown>>(
  config: T,
  options: InterpolationOptions = {}
): T {
  return interpolateValue(config, options);
}

/**
 * Extracts all environment variable references from a value
 * 
 * Useful for validation and documentation purposes.
 * Returns a list of all ${ENV_VAR} references found.
 * 
 * @param value - Value to scan for environment variable references
 * @returns Array of environment variable names (without ${} syntax)
 * 
 * @example
 * ```typescript
 * const config = {
 *   database: {
 *     url: '${DATABASE_URL}',
 *     replicas: ['${REPLICA_1}', '${REPLICA_2}']
 *   },
 *   api: {
 *     key: '${API_KEY:-default}'
 *   }
 * };
 * 
 * const vars = extractEnvVars(config);
 * // => ['DATABASE_URL', 'REPLICA_1', 'REPLICA_2', 'API_KEY']
 * ```
 */
export function extractEnvVars(value: unknown): string[] {
  const vars = new Set<string>();
  
  function extract(val: unknown): void {
    if (val === null || val === undefined) {
      return;
    }
    
    if (typeof val === 'string') {
      const matches = val.matchAll(ENV_VAR_PATTERN);
      for (const match of matches) {
        const varName = match[1];
        if (varName) {
          vars.add(varName);
        }
      }
    } else if (Array.isArray(val)) {
      val.forEach(extract);
    } else if (typeof val === 'object') {
      Object.values(val).forEach(extract);
    }
  }
  
  extract(value);
  return Array.from(vars).sort();
}

/**
 * Validates that all required environment variables are defined
 * 
 * Checks if all environment variable references in a configuration
 * have corresponding values in the environment.
 * 
 * @param config - Configuration object to validate
 * @param options - Interpolation options
 * @returns Object with validation results
 * 
 * @example
 * ```typescript
 * const config = {
 *   database: {
 *     url: '${DATABASE_URL}',
 *     replicas: ['${REPLICA_1}']
 *   }
 * };
 * 
 * const result = validateEnvVars(config);
 * if (!result.valid) {
 *   console.error('Missing environment variables:', result.missing);
 *   // => ['DATABASE_URL', 'REPLICA_1']
 * }
 * ```
 */
export function validateEnvVars(
  config: unknown,
  options: InterpolationOptions = {}
): {
  valid: boolean;
  missing: string[];
  defined: string[];
} {
  const { env = process.env } = options;
  const allVars = extractEnvVars(config);
  
  const missing: string[] = [];
  const defined: string[] = [];
  
  for (const varName of allVars) {
    if (env[varName] === undefined) {
      missing.push(varName);
    } else {
      defined.push(varName);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    defined,
  };
}

/**
 * Generates a .env.example file content from a configuration object
 * 
 * Extracts all environment variable references and creates a template
 * .env file with placeholder values.
 * 
 * @param config - Configuration object to analyze
 * @param options - Generation options
 * @returns .env.example file content as a string
 * 
 * @example
 * ```typescript
 * const config = {
 *   database: {
 *     url: '${DATABASE_URL}',
 *     replicas: ['${REPLICA_1}']
 *   },
 *   api: {
 *     key: '${API_KEY:-default_key}'
 *   }
 * };
 * 
 * const envExample = generateEnvExample(config);
 * console.log(envExample);
 * // =>
 * // # Database configuration
 * // DATABASE_URL=
 * // REPLICA_1=
 * // 
 * // # API configuration
 * // API_KEY=default_key
 * ```
 */
export function generateEnvExample(
  config: unknown,
  options: {
    /** Include comments for each section */
    includeComments?: boolean;
    /** Group variables by config section */
    groupBySections?: boolean;
  } = {}
): string {
  const { includeComments = true } = options;
  const vars = extractEnvVars(config);
  
  if (vars.length === 0) {
    return '# No environment variables required\n';
  }
  
  const lines: string[] = [];
  
  if (includeComments) {
    lines.push('# Environment Variables');
    lines.push('# Copy this file to .env and fill in the values');
    lines.push('');
  }
  
  for (const varName of vars) {
    lines.push(`${varName}=`);
  }
  
  return lines.join('\n') + '\n';
}
