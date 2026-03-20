# @web-loom/api-metrics

Prometheus-compatible metrics collection for [Web Loom API](https://github.com/bretuobay/web-loom-api). Tracks HTTP request rates, latencies, database query times, cache hit rates, and custom application metrics — all exposed at a `/metrics` scrape endpoint.

## Installation

```bash
npm install @web-loom/api-metrics hono
```

## Usage

### Auto-Configuration via `api-core`

When using `@web-loom/api-core`, enable metrics in `defineConfig`:

```typescript
defineConfig({
  observability: {
    metrics: { enabled: true, endpoint: '/metrics' },
  },
});
```

This automatically registers HTTP request/response metrics and exposes `/metrics` for Prometheus to scrape.

### Standalone

```typescript
import { MetricsRegistry, handleMetricsRequest } from '@web-loom/api-metrics';
import { Hono } from 'hono';

const registry = new MetricsRegistry();

// Register built-in HTTP metrics middleware
const app = new Hono();
app.use('/*', registry.httpMiddleware());

// Expose the /metrics scrape endpoint
app.get('/metrics', (c) => handleMetricsRequest(registry, c));
```

## Custom Metrics

```typescript
const registry = new MetricsRegistry();

// Counter — monotonically increasing
const signups = registry.counter('user_signups_total', 'Total user sign-ups', ['plan']);
signups.inc({ plan: 'pro' });

// Gauge — current value that can go up or down
const activeConnections = registry.gauge('active_connections', 'Current WebSocket connections');
activeConnections.set(42);
activeConnections.inc();
activeConnections.dec();

// Histogram — latency/size distributions
const queryDuration = registry.histogram(
  'db_query_duration_seconds',
  'Database query latency',
  [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
);
const end = queryDuration.startTimer({ table: 'users' });
await db.select().from(usersTable);
end(); // records the observation

// Summary — quantile estimation
const responseSize = registry.summary('http_response_size_bytes', 'HTTP response sizes');
responseSize.observe(1024);
```

## Built-In Metrics

When metrics are enabled, these are collected automatically:

| Metric                          | Type      | Description                            |
| ------------------------------- | --------- | -------------------------------------- |
| `http_requests_total`           | Counter   | Total requests by method, path, status |
| `http_request_duration_seconds` | Histogram | Request latency                        |
| `http_request_size_bytes`       | Histogram | Request body size                      |
| `http_response_size_bytes`      | Histogram | Response body size                     |
| `db_query_duration_seconds`     | Histogram | Database query latency                 |
| `cache_hits_total`              | Counter   | Cache hits by store                    |
| `cache_misses_total`            | Counter   | Cache misses by store                  |

## Prometheus Scrape Format

The `/metrics` endpoint returns Prometheus text format:

```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/users",status="200"} 1532
http_requests_total{method="POST",path="/users",status="201"} 87
```

## `MetricsRegistry` API

```typescript
registry.counter(name, help, labelNames?)   // Create/get Counter
registry.gauge(name, help, labelNames?)     // Create/get Gauge
registry.histogram(name, help, buckets?)    // Create/get Histogram
registry.summary(name, help, quantiles?)    // Create/get Summary
registry.httpMiddleware()                    // Hono middleware for HTTP metrics
registry.collect()                          // Collect all metrics → string
```

## License

MIT
