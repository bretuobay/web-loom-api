import { MetricsRegistry } from './metrics-registry';
import type { Counter, Histogram, Gauge } from './types';

/**
 * Pre-registered request metrics for HTTP observability.
 */
export interface RequestMetrics {
  httpRequestsTotal: Counter;
  httpRequestDurationSeconds: Histogram;
  httpRequestSizeBytes: Histogram;
  httpResponseSizeBytes: Histogram;
}

/**
 * Pre-registered database metrics.
 */
export interface DatabaseMetrics {
  dbQueriesTotal: Counter;
  dbQueryDurationSeconds: Histogram;
  dbConnectionsActive: Gauge;
}

/**
 * Pre-registered cache metrics.
 */
export interface CacheMetrics {
  cacheHitsTotal: Counter;
  cacheMissesTotal: Counter;
  cacheHitRate: Gauge;
}

/**
 * Pre-registered application metrics.
 */
export interface ApplicationMetrics {
  appColdStartsTotal: Counter;
  appErrorsTotal: Counter;
}

/**
 * Register all default request metrics on the given registry.
 */
export function registerRequestMetrics(registry: MetricsRegistry): RequestMetrics {
  return {
    httpRequestsTotal: registry.createCounter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
    }),
    httpRequestDurationSeconds: registry.createHistogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status'],
    }),
    httpRequestSizeBytes: registry.createHistogram({
      name: 'http_request_size_bytes',
      help: 'HTTP request body size in bytes',
      labelNames: ['method', 'path'],
      buckets: [100, 1000, 10000, 100000, 1000000],
    }),
    httpResponseSizeBytes: registry.createHistogram({
      name: 'http_response_size_bytes',
      help: 'HTTP response body size in bytes',
      labelNames: ['method', 'path', 'status'],
      buckets: [100, 1000, 10000, 100000, 1000000],
    }),
  };
}

/**
 * Register all default database metrics on the given registry.
 */
export function registerDatabaseMetrics(registry: MetricsRegistry): DatabaseMetrics {
  return {
    dbQueriesTotal: registry.createCounter({
      name: 'db_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'table'],
    }),
    dbQueryDurationSeconds: registry.createHistogram({
      name: 'db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation', 'table'],
    }),
    dbConnectionsActive: registry.createGauge({
      name: 'db_connections_active',
      help: 'Number of active database connections',
    }),
  };
}

/**
 * Register all default cache metrics on the given registry.
 */
export function registerCacheMetrics(registry: MetricsRegistry): CacheMetrics {
  return {
    cacheHitsTotal: registry.createCounter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache'],
    }),
    cacheMissesTotal: registry.createCounter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache'],
    }),
    cacheHitRate: registry.createGauge({
      name: 'cache_hit_rate',
      help: 'Cache hit rate (0-1)',
      labelNames: ['cache'],
    }),
  };
}

/**
 * Register all default application metrics on the given registry.
 */
export function registerApplicationMetrics(registry: MetricsRegistry): ApplicationMetrics {
  return {
    appColdStartsTotal: registry.createCounter({
      name: 'app_cold_starts_total',
      help: 'Total number of application cold starts',
    }),
    appErrorsTotal: registry.createCounter({
      name: 'app_errors_total',
      help: 'Total number of application errors',
      labelNames: ['type'],
    }),
  };
}
