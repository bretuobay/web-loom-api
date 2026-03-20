# @web-loom/api-logging

Structured logging with sensitive data sanitization for [Web Loom API](https://github.com/bretuobay/web-loom-api). Configurable log levels, JSON/pretty formatting, and automatic redaction of passwords, tokens, and PII.

## Installation

```bash
npm install @web-loom/api-logging
```

## Usage

```typescript
import { Logger } from '@web-loom/api-logging';

const logger = new Logger({
  level: 'info', // 'debug' | 'info' | 'warn' | 'error'
  format: 'json', // 'json' | 'pretty'
});

logger.info('Server started', { port: 3000 });
logger.warn('Slow query detected', { query: 'SELECT ...', duration: 1500 });
logger.error('Unhandled error', { error: err.message, stack: err.stack });
logger.debug('Cache miss', { key: 'user:123' });
```

### JSON Output (production)

```json
{
  "level": "info",
  "message": "Server started",
  "port": 3000,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Pretty Output (development)

```
[10:30:00] INFO  Server started port=3000
```

## Sensitive Data Sanitization

`LogSanitizer` automatically redacts sensitive fields before they reach log output.

```typescript
import { Logger, LogSanitizer } from '@web-loom/api-logging';

const sanitizer = new LogSanitizer({
  // These fields will be replaced with '[REDACTED]' in all log entries
  redactedFields: ['password', 'token', 'apiKey', 'authorization', 'creditCard'],
});

const logger = new Logger({ level: 'info', format: 'json', sanitizer });

logger.info('User login', { email: 'user@example.com', password: 'secret123' });
// Output: {"email":"user@example.com","password":"[REDACTED]","..."}
```

Default redacted fields: `password`, `passwordHash`, `token`, `accessToken`, `refreshToken`, `apiKey`, `secret`, `authorization`, `cookie`, `ssn`, `creditCard`, `cvv`.

## Child Loggers

```typescript
// Create a child logger with fixed context fields
const requestLogger = logger.child({ requestId: req.id, userId: user.id });

requestLogger.info('Processing payment');
// Output includes requestId and userId in every log entry
```

## Log Levels

| Level   | When to use                                                |
| ------- | ---------------------------------------------------------- |
| `debug` | Detailed diagnostic information (development only)         |
| `info`  | Normal operational events (startup, requests, completions) |
| `warn`  | Unexpected but recoverable situations                      |
| `error` | Errors that require attention                              |

## `Logger` Options

| Option        | Type                                     | Default           | Description              |
| ------------- | ---------------------------------------- | ----------------- | ------------------------ |
| `level`       | `'debug' \| 'info' \| 'warn' \| 'error'` | `'info'`          | Minimum log level        |
| `format`      | `'json' \| 'pretty'`                     | `'json'`          | Output format            |
| `sanitizer`   | `LogSanitizer`                           | default sanitizer | Sensitive field redactor |
| `destination` | `WritableStream`                         | `process.stdout`  | Log destination          |

## License

MIT
