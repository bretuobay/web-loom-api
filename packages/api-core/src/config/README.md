# Configuration Module

This module provides type-safe configuration schema and utilities for the Web Loom API Framework.

## Features

- **Type-Safe Configuration**: Full TypeScript support with IDE autocomplete
- **Environment Variable Interpolation**: Use `${ENV_VAR}` syntax in configuration values
- **Configuration Presets**: Pre-configured settings for common deployment scenarios
- **Validation**: Runtime validation of configuration values
- **Comprehensive Documentation**: JSDoc comments for every configuration option

## Usage

### Basic Configuration

```typescript
// webloom.config.ts
import { defineConfig } from '@webloom/api-core';

export default defineConfig({
  adapters: {
    api: { package: '@webloom/api-adapter-hono' },
    database: { package: '@webloom/api-adapter-drizzle' },
    validation: { package: '@webloom/api-adapter-zod' }
  },
  database: {
    url: '${DATABASE_URL}',
    poolSize: 10
  },
  security: {
    cors: {
      origins: ['https://app.example.com'],
      credentials: true
    }
  },
  features: {
    crud: true
  },
  observability: {
    logging: {
      level: 'info',
      format: 'json'
    }
  }
});
```

### Environment Variable Interpolation

Configuration values support environment variable interpolation using `${ENV_VAR}` syntax:

```typescript
database: {
  url: '${DATABASE_URL}',
  readReplicas: ['${REPLICA_1}', '${REPLICA_2}']
}
```

Default values can be provided:

```typescript
database: {
  url: '${DATABASE_URL:-postgresql://localhost:5432/dev}'
}
```

### Configuration Presets

Use presets for common deployment scenarios:

```typescript
import { defineConfig, createPreset } from '@webloom/api-core';

export default defineConfig({
  ...createPreset('serverless'),
  database: {
    url: '${DATABASE_URL}'
  },
  security: {
    cors: {
      origins: ['https://app.example.com']
    }
  }
});
```

Available presets:
- `minimal`: Basic setup with minimal features
- `serverless`: Optimized for serverless/edge deployment
- `full-stack`: Full-featured setup with GraphQL, WebSocket, caching
- `enterprise`: Production-ready with security, audit logging, observability

## Configuration Sections

### Adapters

Specify which adapter implementations to use:

```typescript
adapters: {
  api: { package: '@webloom/api-adapter-hono' },
  database: { package: '@webloom/api-adapter-drizzle' },
  validation: { package: '@webloom/api-adapter-zod' },
  auth: { package: '@webloom/api-adapter-lucia' },
  email: { package: '@webloom/api-adapter-resend' }
}
```

### Database

Database connection and pooling configuration:

```typescript
database: {
  url: '${DATABASE_URL}',
  poolSize: 10,
  connectionTimeout: 10000,
  readReplicas: ['${READ_REPLICA_1}'],
  ssl: true
}
```

### Security

CORS, rate limiting, and security headers:

```typescript
security: {
  cors: {
    origins: ['https://app.example.com'],
    credentials: true
  },
  rateLimit: {
    limit: 100,
    window: '1m'
  },
  requestSizeLimit: 1048576,
  securityHeaders: {
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true
    }
  }
}
```

### Features

Enable or disable framework features:

```typescript
features: {
  crud: true,
  graphql: false,
  websocket: false,
  caching: true,
  auditLogging: false
}
```

### Observability

Logging, metrics, and tracing configuration:

```typescript
observability: {
  logging: {
    level: 'info',
    format: 'json',
    redact: ['password', 'token']
  },
  metrics: {
    enabled: true,
    collectDefault: true
  },
  tracing: {
    enabled: true,
    exporter: 'otlp',
    endpoint: 'https://otel-collector.example.com',
    serviceName: 'api'
  }
}
```

### Development

Development-specific settings:

```typescript
development: {
  hotReload: true,
  apiDocs: true,
  detailedErrors: true
}
```

## API Reference

See the TypeScript definitions in `types.ts` for complete API documentation with JSDoc comments.
