import { describe, it, expect } from 'vitest';
import { validateConfig, validateConfigOrThrow, ConfigurationValidationError } from '../validation';
import type { WebLoomConfig } from '../types';

describe('Configuration Validation', () => {
  const validConfig: WebLoomConfig = {
    adapters: {
      api: { package: '@webloom/api-adapter-hono' },
      database: { package: '@webloom/api-adapter-drizzle' },
      validation: { package: '@webloom/api-adapter-zod' },
    },
    database: {
      url: 'postgresql://localhost:5432/test',
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

    it('should reject configuration with missing required fields', () => {
      const invalidConfig = {
        adapters: {
          api: { package: '@webloom/api-adapter-hono' },
          // Missing database and validation adapters
        },
      };

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject configuration with invalid database URL', () => {
      const invalidConfig = {
        ...validConfig,
        database: {
          url: '', // Empty URL
        },
      };

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(err => err.path.includes('database'))).toBe(true);
    });

    it('should reject configuration with invalid log level', () => {
      const invalidConfig = {
        ...validConfig,
        observability: {
          logging: {
            level: 'verbose', // Invalid level
          },
        },
      };

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(err => 
        err.path.join('.').includes('logging.level')
      )).toBe(true);
    });

    it('should reject configuration with invalid rate limit window', () => {
      const invalidConfig = {
        ...validConfig,
        security: {
          ...validConfig.security,
          rateLimit: {
            limit: 100,
            window: '5 minutes', // Invalid format
          },
        },
      };

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(err => 
        err.path.join('.').includes('rateLimit.window')
      )).toBe(true);
    });

    it('should accept valid rate limit window formats', () => {
      const windows = ['30s', '1m', '5m', '1h', '24h', '1d', '7d'];

      for (const window of windows) {
        const config = {
          ...validConfig,
          security: {
            ...validConfig.security,
            rateLimit: {
              limit: 100,
              window,
            },
          },
        };

        const result = validateConfig(config);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('validateConfigOrThrow', () => {
    it('should return validated config for valid input', () => {
      const result = validateConfigOrThrow(validConfig);

      expect(result).toBeDefined();
      expect(result.adapters).toBeDefined();
      expect(result.database).toBeDefined();
    });

    it('should throw ConfigurationValidationError for invalid input', () => {
      const invalidConfig = {
        adapters: {
          api: { package: '@webloom/api-adapter-hono' },
        },
      };

      expect(() => validateConfigOrThrow(invalidConfig)).toThrow(
        ConfigurationValidationError
      );
    });

    it('should include detailed error messages', () => {
      const invalidConfig = {
        adapters: {
          api: { package: '@webloom/api-adapter-hono' },
        },
      };

      try {
        validateConfigOrThrow(invalidConfig);
        expect.fail('Should have thrown an error');
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
    it('should accept configuration with optional auth adapter', () => {
      const configWithAuth = {
        ...validConfig,
        adapters: {
          ...validConfig.adapters,
          auth: { package: '@webloom/api-adapter-lucia' },
        },
      };

      const result = validateConfig(configWithAuth);
      expect(result.success).toBe(true);
    });

    it('should accept configuration with optional email adapter', () => {
      const configWithEmail = {
        ...validConfig,
        adapters: {
          ...validConfig.adapters,
          email: { package: '@webloom/api-adapter-resend' },
        },
      };

      const result = validateConfig(configWithEmail);
      expect(result.success).toBe(true);
    });

    it('should accept configuration with development settings', () => {
      const configWithDev = {
        ...validConfig,
        development: {
          hotReload: true,
          apiDocs: true,
          detailedErrors: true,
        },
      };

      const result = validateConfig(configWithDev);
      expect(result.success).toBe(true);
    });
  });
});
