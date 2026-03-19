# Configuration Management

This module provides comprehensive configuration management for the Web Loom API Framework, including:

- Type-safe configuration schema with TypeScript
- Runtime validation using Zod
- Environment variable interpolation
- Environment-specific .env file loading
- Detailed error messages for validation failures

## Quick Start

### 1. Create Configuration File

Create `webloom.config.ts` in your project root:

```typescript
import { defineConfig } from '@web-loom/api-core';

export default defineConfig({
  adapters: {
    api: { package: '@web-loom/api-adapter-hono' },
    database: { package: '@web-loom/api-adapter-drizzle' },
    validation: { package: '@web-loom/api-adapter-zod' },
  },
  database: {
    url: '${DATABASE_URL}',
    poolSize: 10,
    ssl: true,
  },
  security: {
    cors: {
      origins: ['https://app.example.com'],
      credentials: true,
    },
  },
  features: {
    crud: true,
  },
  observability: {
    logging: {
      level: 'info',
      format: 'json',
    },
  },
});
```

### 2. Create Environment Files

Create `.env` for base configuration:

```bash
DATABASE_URL=postgresql://localhost:5432/mydb
```

Create `.env.development` for development overrides:

```bash
DATABASE_URL=postgresql://localhost:5432/mydb_dev
```

Create `.env.production` for production:

```bash
DATABASE_URL=postgresql://prod-host:5432/mydb_prod
```

### 3. Load and Validate Configuration

```typescript
import { loadConfig } from '@web-loom/api-core';
import config from './webloom.config';

try {
  const { config: validConfig } = loadConfig({
    config,
    envOptions: {
      environment: process.env.NODE_ENV,
      debug: true,
    },
  });

  console.log('Configuration loaded successfully!');
  console.log('Database URL:', validConfig.database.url);
} catch (error) {
  console.error('Configuration validation failed:', error.message);
  process.exit(1);
}
```

## Validation

### Automatic Validation

Configuration is automatically validated when using `loadConfig()`:

```typescript
const { config } = loadConfig({ config: myConfig });
// Config is validated and typed
```

### Manual Validation

You can also validate configuration manually:

```typescript
import { validateConfig, validateConfigOrThrow } from '@web-loom/api-core';

// Returns validation result
const result = validateConfig(myConfig);
if (result.success) {
  console.log('Valid config:', result.data);
} else {
  console.error('Validation errors:', result.errors);
}

// Throws on validation failure
try {
  const validConfig = validateConfigOrThrow(myConfig);
} catch (error) {
  // Handle ConfigurationValidationError
}
```

## Environment Variable Interpolation

Use `${ENV_VAR}` syntax in your configuration:

```typescript
export default defineConfig({
  database: {
    url: '${DATABASE_URL}',
    poolSize: parseInt('${DB_POOL_SIZE}', 10) || 10,
  },
  security: {
    cors: {
      origins: ['${FRONTEND_URL}'],
    },
  },
});
```

Variables are interpolated automatically when using `loadConfig()`.

## Environment-Specific Overrides

The framework loads .env files in this order (later files override earlier ones):

1. `.env` - Base configuration (committed)
2. `.env.local` - Local overrides (not committed)
3. `.env.[environment]` - Environment-specific (e.g., `.env.development`)
4. `.env.[environment].local` - Environment-specific local overrides

Example:

```bash
# .env (base)
DATABASE_URL=postgresql://localhost:5432/mydb
LOG_LEVEL=info

# .env.development (development overrides)
DATABASE_URL=postgresql://localhost:5432/mydb_dev
LOG_LEVEL=debug

# .env.production (production overrides)
DATABASE_URL=postgresql://prod-host:5432/mydb_prod
LOG_LEVEL=warn
```

## Validation Errors

When validation fails, you get detailed error messages:

```
Configuration validation failed:
  - database.url: Database URL is required
  - security.cors.origins: Expected array, received undefined
  - observability.logging.level: Invalid enum value. Expected 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal', received 'verbose'

Please check your webloom.config.ts file and fix the errors above.
```

## Configuration Schema

The configuration schema validates:

### Required Fields

- `adapters.api` - API framework adapter
- `adapters.database` - Database adapter
- `adapters.validation` - Validation adapter
- `database.url` - Database connection URL
- `security.cors` - CORS configuration
- `features` - Feature flags
- `observability.logging` - Logging configuration

### Optional Fields

- `adapters.auth` - Authentication adapter
- `adapters.email` - Email adapter
- `database.poolSize` - Connection pool size
- `database.connectionTimeout` - Connection timeout
- `database.readReplicas` - Read replica URLs
- `security.rateLimit` - Rate limiting configuration
- `security.requestSizeLimit` - Max request body size
- `security.securityHeaders` - Security headers
- `observability.metrics` - Metrics configuration
- `observability.tracing` - Tracing configuration
- `development` - Development settings

### Type Constraints

- `database.poolSize` - Must be a positive integer
- `database.connectionTimeout` - Must be a positive integer
- `security.rateLimit.limit` - Must be a positive integer
- `security.rateLimit.window` - Must match format: `30s`, `1m`, `1h`, `1d`
- `observability.logging.level` - Must be one of: `trace`, `debug`, `info`, `warn`, `error`, `fatal`
- `observability.tracing.sampleRate` - Must be between 0 and 1

## API Reference

### `loadConfig(options?)`

Loads and validates configuration with full environment support.

**Parameters:**

- `options.config` - Configuration object or file path
- `options.envOptions` - Environment loading options
- `options.validate` - Whether to validate (default: true)
- `options.interpolate` - Whether to interpolate env vars (default: true)

**Returns:** `LoadConfigResult` with validated config, loaded env files, and parsed env vars

### `validateConfig(config)`

Validates configuration and returns result.

**Parameters:**

- `config` - Configuration object to validate

**Returns:** `ValidationResult<WebLoomConfig>` with success flag, data, or errors

### `validateConfigOrThrow(config)`

Validates configuration and throws on failure.

**Parameters:**

- `config` - Configuration object to validate

**Returns:** Validated `WebLoomConfig`

**Throws:** `ConfigurationValidationError` if validation fails

### `loadEnvFiles(options?)`

Loads .env files with environment-specific overrides.

**Parameters:**

- `options.cwd` - Base directory (default: `process.cwd()`)
- `options.environment` - Environment name (default: `process.env.NODE_ENV`)
- `options.override` - Override existing env vars (default: false)
- `options.debug` - Log loaded files (default: false)

**Returns:** `EnvLoaderResult` with loaded files and parsed variables

## Best Practices

1. **Use environment variables for sensitive data**: Never commit secrets to version control
2. **Validate early**: Load and validate config at application startup
3. **Use environment-specific files**: Separate development and production configs
4. **Add .env.local to .gitignore**: Keep local overrides private
5. **Provide .env.example**: Document required environment variables
6. **Use type-safe access**: Let TypeScript catch config errors at compile time
7. **Handle validation errors gracefully**: Provide clear error messages to users

## Example: Complete Startup Flow

```typescript
import { loadConfig } from '@web-loom/api-core';
import config from './webloom.config';

async function bootstrap() {
  try {
    // Load and validate configuration
    const { config: validConfig, envFiles } = loadConfig({
      config,
      envOptions: {
        environment: process.env.NODE_ENV || 'development',
        debug: process.env.DEBUG === 'true',
      },
    });

    console.log('✓ Configuration loaded successfully');
    console.log('  Loaded env files:', envFiles.join(', '));

    // Initialize application with validated config
    const app = await initializeApp(validConfig);

    // Start server
    await app.start();

    console.log('✓ Application started successfully');
  } catch (error) {
    if (error.name === 'ConfigurationValidationError') {
      console.error('✗ Configuration validation failed:');
      console.error(error.message);
    } else {
      console.error('✗ Application startup failed:', error);
    }
    process.exit(1);
  }
}

bootstrap();
```
