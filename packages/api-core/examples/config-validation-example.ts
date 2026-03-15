/**
 * Configuration Validation Example
 * 
 * This example demonstrates how to use the configuration validation system
 * with environment variable loading and detailed error messages.
 */

import {
  defineConfig,
  loadConfig,
  validateConfig,
  validateConfigOrThrow,
  ConfigurationValidationError,
  type WebLoomConfig,
} from '../src/config';

// ============================================================================
// Example 1: Valid Configuration
// ============================================================================

console.log('=== Example 1: Valid Configuration ===\n');

const validConfig = defineConfig({
  adapters: {
    api: { package: '@webloom/api-adapter-hono' },
    database: { package: '@webloom/api-adapter-drizzle' },
    validation: { package: '@webloom/api-adapter-zod' },
  },
  database: {
    url: 'postgresql://localhost:5432/mydb',
    poolSize: 10,
    ssl: true,
  },
  security: {
    cors: {
      origins: ['https://app.example.com'],
      credentials: true,
    },
    rateLimit: {
      limit: 100,
      window: '1m',
    },
  },
  features: {
    crud: true,
    caching: true,
  },
  observability: {
    logging: {
      level: 'info',
      format: 'json',
    },
  },
});

const result1 = validateConfig(validConfig);
if (result1.success) {
  console.log('✓ Configuration is valid!');
  console.log('  Database URL:', result1.data?.database.url);
  console.log('  CORS origins:', result1.data?.security.cors.origins);
} else {
  console.error('✗ Validation failed:', result1.errors);
}

// ============================================================================
// Example 2: Invalid Configuration - Missing Required Fields
// ============================================================================

console.log('\n=== Example 2: Invalid Configuration - Missing Fields ===\n');

const invalidConfig1 = {
  adapters: {
    api: { package: '@webloom/api-adapter-hono' },
    // Missing database and validation adapters
  },
  database: {
    url: 'postgresql://localhost:5432/mydb',
  },
  // Missing security, features, and observability
};

const result2 = validateConfig(invalidConfig1);
if (!result2.success) {
  console.log('✗ Configuration validation failed:');
  result2.errors?.forEach((err) => {
    console.log(`  - ${err.path.join('.')}: ${err.message}`);
  });
}

// ============================================================================
// Example 3: Invalid Configuration - Wrong Types
// ============================================================================

console.log('\n=== Example 3: Invalid Configuration - Wrong Types ===\n');

const invalidConfig2 = {
  ...validConfig,
  database: {
    url: '', // Empty URL
    poolSize: -5, // Negative pool size
  },
  observability: {
    logging: {
      level: 'verbose', // Invalid log level
    },
  },
};

const result3 = validateConfig(invalidConfig2);
if (!result3.success) {
  console.log('✗ Configuration validation failed:');
  result3.errors?.forEach((err) => {
    console.log(`  - ${err.path.join('.')}: ${err.message}`);
  });
}

// ============================================================================
// Example 4: Using validateConfigOrThrow
// ============================================================================

console.log('\n=== Example 4: Using validateConfigOrThrow ===\n');

try {
  const validated = validateConfigOrThrow(validConfig);
  console.log('✓ Configuration validated successfully!');
  console.log('  Type-safe access:', validated.database.poolSize);
} catch (error) {
  if (error instanceof ConfigurationValidationError) {
    console.error('✗ Configuration validation failed:');
    console.error(error.message);
  }
}

// ============================================================================
// Example 5: Configuration with Environment Variables
// ============================================================================

console.log('\n=== Example 5: Configuration with Environment Variables ===\n');

const configWithEnvVars = defineConfig({
  adapters: {
    api: { package: '@webloom/api-adapter-hono' },
    database: { package: '@webloom/api-adapter-drizzle' },
    validation: { package: '@webloom/api-adapter-zod' },
  },
  database: {
    url: '${DATABASE_URL}', // Will be interpolated from environment
    poolSize: 10,
  },
  security: {
    cors: {
      origins: ['${FRONTEND_URL}'], // Will be interpolated
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
});

// Set environment variables for demonstration
process.env.DATABASE_URL = 'postgresql://localhost:5432/prod_db';
process.env.FRONTEND_URL = 'https://app.production.com';

try {
  const { config: loadedConfig } = loadConfig({
    config: configWithEnvVars,
    envOptions: {
      environment: 'production',
    },
  });

  console.log('✓ Configuration loaded and validated!');
  console.log('  Database URL:', loadedConfig.database.url);
  console.log('  CORS origins:', loadedConfig.security.cors.origins);
} catch (error) {
  if (error instanceof ConfigurationValidationError) {
    console.error('✗ Configuration validation failed:');
    console.error(error.message);
  } else {
    console.error('✗ Error loading configuration:', error);
  }
}

// ============================================================================
// Example 6: Rate Limit Window Validation
// ============================================================================

console.log('\n=== Example 6: Rate Limit Window Validation ===\n');

const validWindows = ['30s', '1m', '5m', '1h', '24h', '1d', '7d'];
const invalidWindows = ['5 minutes', '1 hour', '30', 'invalid'];

console.log('Valid rate limit windows:');
validWindows.forEach((window) => {
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
  console.log(`  ${window}: ${result.success ? '✓' : '✗'}`);
});

console.log('\nInvalid rate limit windows:');
invalidWindows.forEach((window) => {
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
  console.log(`  ${window}: ${result.success ? '✓' : '✗'}`);
  if (!result.success) {
    const error = result.errors?.find((e) =>
      e.path.join('.').includes('window')
    );
    if (error) {
      console.log(`    Error: ${error.message}`);
    }
  }
});

console.log('\n=== All Examples Complete ===\n');
