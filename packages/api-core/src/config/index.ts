/**
 * Configuration management module
 * 
 * Provides type-safe configuration schema, environment variable interpolation,
 * validation, and configuration utilities for the Web Loom API Framework.
 * 
 * @module config
 */

// Export configuration types
export * from './types';

// Export environment variable interpolation utilities
export * from './env-interpolation';

// Export configuration definition utilities
export * from './define-config';

// Export configuration validation (with renamed types to avoid conflicts)
export type {
  ValidationError as ConfigValidationError,
  ValidationResult as ConfigValidationResult,
} from './validation';
export { validateConfig, validateConfigOrThrow, ConfigurationValidationError } from './validation';

// Export environment file loading
export * from './env-loader';

// Export configuration loading utilities
export * from './load-config';
