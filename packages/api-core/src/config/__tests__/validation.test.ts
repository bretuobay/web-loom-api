import { describe, it, expect } from 'vitest';
import { validateConfig, validateConfigOrThrow, ConfigurationValidationError } from '../validation';
import type { WebLoomConfig } from '../types';

describe('Configuration Validation', () => {
  const validConfig: WebLoomConfig = {
    database: {
      url: 'postgresql://localhost:5432/test',
      driver: 'pg',
    },
    security: {
      cors: {
        origins: ['https://example.com'],
      },
    },
    features: {
      crud: true,
    },
    observability: {
      logging: {
        level: 'info',
      },
    },
  };

  describe('validateConfig', () => {
    it('should validate a valid configuration', () => {
      const result = validateConfig(validConfig);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should reject configuration with missing database field', () => {
      const invalidConfig = {};

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject configuration with missing database.driver', () => {
      const invalidConfig = {
        database: { url: 'postgresql://localhost:5432/test' },
      };

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.errors!.some((err) => err.path.includes('driver'))).toBe(true);
    });

    it('should reject configuration with invalid database URL', () => {
      const invalidConfig = {
        ...validConfig,
        database: { url: '', driver: 'pg' as const },
      };

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.errors!.some((err) => err.path.includes('database'))).toBe(true);
    });

    it('should reject configuration with invalid driver', () => {
      const invalidConfig = {
        database: { url: 'postgresql://localhost/test', driver: 'mysql' },
      };

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.errors!.some((err) => err.path.includes('driver'))).toBe(true);
    });

    it('should accept all valid driver values', () => {
      for (const driver of ['neon-serverless', 'libsql', 'pg'] as const) {
        const result = validateConfig({
          database: { url: 'some://url', driver },
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject configuration with invalid log level', () => {
      const invalidConfig = {
        ...validConfig,
        observability: { logging: { level: 'verbose' } },
      };

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.errors!.some((err) => err.path.join('.').includes('level'))).toBe(true);
    });

    it('should reject configuration with invalid rate limit window', () => {
      const invalidConfig = {
        ...validConfig,
        security: {
          ...validConfig.security,
          rateLimit: { limit: 100, window: '5 minutes' },
        },
      };

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.errors!.some((err) => err.path.join('.').includes('rateLimit'))).toBe(true);
    });

    it('should accept valid rate limit window formats', () => {
      for (const window of ['30s', '1m', '5m', '1h', '24h', '1d', '7d']) {
        const config = {
          ...validConfig,
          security: { ...validConfig.security, rateLimit: { limit: 100, window } },
        };
        expect(validateConfig(config).success).toBe(true);
      }
    });
  });

  describe('validateConfigOrThrow', () => {
    it('should return validated config for valid input', () => {
      const result = validateConfigOrThrow(validConfig);
      expect(result.database).toBeDefined();
      expect(result.database.driver).toBe('pg');
    });

    it('should throw ConfigurationValidationError for invalid input', () => {
      expect(() => validateConfigOrThrow({})).toThrow(ConfigurationValidationError);
    });

    it('should include detailed error messages', () => {
      try {
        validateConfigOrThrow({});
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        expect((error as ConfigurationValidationError).message).toContain(
          'Configuration validation failed'
        );
        expect((error as ConfigurationValidationError).errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Optional fields', () => {
    it('should accept configuration with development settings', () => {
      const result = validateConfig({
        ...validConfig,
        development: { hotReload: true, apiDocs: true, detailedErrors: true },
      });
      expect(result.success).toBe(true);
    });

    it('should accept configuration with openapi settings', () => {
      const result = validateConfig({
        ...validConfig,
        openapi: { enabled: true, ui: 'swagger', title: 'My API', version: '1.0.0' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept configuration with routes settings', () => {
      const result = validateConfig({
        ...validConfig,
        routes: { dir: './src/routes' },
      });
      expect(result.success).toBe(true);
    });
  });
});
