# @web-loom/api-health

Health check endpoints for [Web Loom API](https://github.com/bretuobay/web-loom-api). Liveness and readiness probes suitable for Kubernetes, Docker, and cloud load balancers.

## Installation

```bash
npm install @web-loom/api-health hono
```

## Usage

### Mount Health Routes

```typescript
import { HealthChecker, createHealthRoutes } from '@web-loom/api-health';
import { createApp } from '@web-loom/api-core';

const checker = new HealthChecker();

// Built-in database check
checker.addCheck(createDatabaseCheck(db));

// Custom check
checker.addCheck({
  name: 'redis',
  check: async () => {
    await redis.ping();
    return { status: 'healthy' };
  },
});

const app = await createApp(config);

// Mount health routes
const healthRoutes = createHealthRoutes(checker);
app.hono.route('/health', healthRoutes);
```

### Endpoints

| Endpoint            | Description                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| `GET /health/live`  | Liveness probe — returns 200 if the process is running                    |
| `GET /health/ready` | Readiness probe — runs all checks; 200 if healthy, 503 if any check fails |
| `GET /health`       | Full health report with all check details                                 |

### Example Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "database": { "status": "healthy", "latencyMs": 12 },
    "redis": { "status": "healthy" }
  }
}
```

When a check fails:

```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "database": { "status": "unhealthy", "error": "Connection timeout" },
    "redis": { "status": "healthy" }
  }
}
```

HTTP status will be `503 Service Unavailable`.

## Built-In Checks

### Database Check

```typescript
import { createDatabaseCheck } from '@web-loom/api-health';

checker.addCheck(
  createDatabaseCheck(db, {
    name: 'postgres', // optional, default 'database'
    query: 'SELECT 1', // optional ping query
    timeoutMs: 3_000, // optional, default 5000
  })
);
```

### Custom Check

```typescript
checker.addCheck({
  name: 'external-api',
  critical: false, // non-critical: failure won't mark app unhealthy
  check: async () => {
    const res = await fetch('https://api.example.com/ping');
    if (!res.ok) throw new Error('API unavailable');
    return { status: 'healthy', latencyMs: Date.now() - start };
  },
});
```

## `HealthChecker` API

```typescript
const checker = new HealthChecker();

checker.addCheck(check); // Register a health check
checker.runAll(); // Run all checks → HealthReport
checker.run(name); // Run a specific check by name
```

## License

MIT
