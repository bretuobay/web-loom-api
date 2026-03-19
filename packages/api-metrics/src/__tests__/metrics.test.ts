import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsRegistry } from '../metrics-registry';
import { handleMetricsRequest, METRICS_CONTENT_TYPE } from '../metrics-endpoint';
import {
  registerRequestMetrics,
  registerDatabaseMetrics,
  registerCacheMetrics,
  registerApplicationMetrics,
} from '../metrics-middleware';

describe('MetricsRegistry', () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    MetricsRegistry.resetInstance();
    registry = MetricsRegistry.getInstance();
  });

  it('should be a singleton', () => {
    const a = MetricsRegistry.getInstance();
    const b = MetricsRegistry.getInstance();
    expect(a).toBe(b);
  });

  it('should reset singleton', () => {
    const a = MetricsRegistry.getInstance();
    MetricsRegistry.resetInstance();
    const b = MetricsRegistry.getInstance();
    expect(a).not.toBe(b);
  });

  describe('Counter', () => {
    it('should create and increment a counter', () => {
      const counter = registry.createCounter({ name: 'test_counter', help: 'A test counter' });
      expect(counter.type).toBe('counter');
      expect(counter.get()).toBe(0);

      counter.inc();
      expect(counter.get()).toBe(1);

      counter.inc(undefined, 5);
      expect(counter.get()).toBe(6);
    });

    it('should support labels', () => {
      const counter = registry.createCounter({ name: 'labeled_counter', help: 'Labeled' });
      counter.inc({ method: 'GET' });
      counter.inc({ method: 'POST' }, 3);

      expect(counter.get({ method: 'GET' })).toBe(1);
      expect(counter.get({ method: 'POST' })).toBe(3);
      expect(counter.get({ method: 'PUT' })).toBe(0);
    });

    it('should throw on negative increment', () => {
      const counter = registry.createCounter({ name: 'neg_counter', help: 'Neg' });
      expect(() => counter.inc(undefined, -1)).toThrow('Counter can only be incremented');
    });

    it('should reset counter values', () => {
      const counter = registry.createCounter({ name: 'reset_counter', help: 'Reset' });
      counter.inc(undefined, 10);
      counter.reset();
      expect(counter.get()).toBe(0);
    });

    it('should return existing counter if same name', () => {
      const a = registry.createCounter({ name: 'dup_counter', help: 'Dup' });
      const b = registry.createCounter({ name: 'dup_counter', help: 'Dup' });
      expect(a).toBe(b);
    });

    it('should throw if name exists with different type', () => {
      registry.createCounter({ name: 'conflict', help: 'Counter' });
      expect(() => registry.createGauge({ name: 'conflict', help: 'Gauge' })).toThrow(
        'Metric "conflict" already exists as counter'
      );
    });
  });

  describe('Gauge', () => {
    it('should create and set a gauge', () => {
      const gauge = registry.createGauge({ name: 'test_gauge', help: 'A test gauge' });
      expect(gauge.type).toBe('gauge');
      expect(gauge.get()).toBe(0);

      gauge.set(42);
      expect(gauge.get()).toBe(42);
    });

    it('should increment and decrement', () => {
      const gauge = registry.createGauge({ name: 'inc_dec_gauge', help: 'Inc/Dec' });
      gauge.inc();
      expect(gauge.get()).toBe(1);
      gauge.inc(undefined, 4);
      expect(gauge.get()).toBe(5);
      gauge.dec();
      expect(gauge.get()).toBe(4);
      gauge.dec(undefined, 2);
      expect(gauge.get()).toBe(2);
    });

    it('should support labels', () => {
      const gauge = registry.createGauge({ name: 'labeled_gauge', help: 'Labeled' });
      gauge.set(10, { region: 'us' });
      gauge.set(20, { region: 'eu' });
      expect(gauge.get({ region: 'us' })).toBe(10);
      expect(gauge.get({ region: 'eu' })).toBe(20);
    });
  });

  describe('Histogram', () => {
    it('should observe values and track in buckets', () => {
      const histogram = registry.createHistogram({
        name: 'test_histogram',
        help: 'A test histogram',
        buckets: [1, 5, 10],
      });
      expect(histogram.type).toBe('histogram');

      histogram.observe(0.5);
      histogram.observe(3);
      histogram.observe(7);
      histogram.observe(15);

      // Verify serialization includes bucket data
      const output = registry.serialize();
      expect(output).toContain('test_histogram_bucket');
      expect(output).toContain('test_histogram_sum');
      expect(output).toContain('test_histogram_count');
    });

    it('should use default buckets when none specified', () => {
      const histogram = registry.createHistogram({
        name: 'default_buckets',
        help: 'Default',
      });
      expect(histogram.buckets).toEqual([0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]);
    });
  });

  describe('Summary', () => {
    it('should observe values', () => {
      const summary = registry.createSummary({
        name: 'test_summary',
        help: 'A test summary',
        quantiles: [0.5, 0.99],
      });
      expect(summary.type).toBe('summary');

      summary.observe(1);
      summary.observe(2);
      summary.observe(3);

      const output = registry.serialize();
      expect(output).toContain('test_summary{quantile="0.5"}');
      expect(output).toContain('test_summary_sum');
      expect(output).toContain('test_summary_count');
    });
  });

  describe('Registry operations', () => {
    it('should get metric by name', () => {
      const counter = registry.createCounter({ name: 'find_me', help: 'Find' });
      expect(registry.getMetric('find_me')).toBe(counter);
      expect(registry.getMetric('not_found')).toBeUndefined();
    });

    it('should get all metrics', () => {
      registry.createCounter({ name: 'c1', help: 'C1' });
      registry.createGauge({ name: 'g1', help: 'G1' });
      const all = registry.getAll();
      expect(all.size).toBe(2);
    });

    it('should reset all metric values', () => {
      const counter = registry.createCounter({ name: 'r_counter', help: 'R' });
      const gauge = registry.createGauge({ name: 'r_gauge', help: 'R' });
      counter.inc(undefined, 10);
      gauge.set(42);

      registry.reset();
      expect(counter.get()).toBe(0);
      expect(gauge.get()).toBe(0);
    });

    it('should clear all metrics', () => {
      registry.createCounter({ name: 'cl1', help: 'CL' });
      registry.clear();
      expect(registry.getAll().size).toBe(0);
    });
  });

  describe('Prometheus serialization', () => {
    it('should serialize empty registry', () => {
      expect(registry.serialize()).toBe('');
    });

    it('should serialize counter in Prometheus format', () => {
      const counter = registry.createCounter({
        name: 'http_requests_total',
        help: 'Total HTTP requests',
      });
      counter.inc({ method: 'GET', status: '200' }, 5);

      const output = registry.serialize();
      expect(output).toContain('# HELP http_requests_total Total HTTP requests');
      expect(output).toContain('# TYPE http_requests_total counter');
      expect(output).toContain('http_requests_total{method="GET",status="200"} 5');
    });

    it('should serialize gauge in Prometheus format', () => {
      const gauge = registry.createGauge({ name: 'db_connections', help: 'Active DB connections' });
      gauge.set(42);

      const output = registry.serialize();
      expect(output).toContain('# HELP db_connections Active DB connections');
      expect(output).toContain('# TYPE db_connections gauge');
      expect(output).toContain('db_connections 42');
    });

    it('should serialize histogram with cumulative buckets', () => {
      const histogram = registry.createHistogram({
        name: 'request_duration',
        help: 'Request duration',
        buckets: [0.1, 0.5, 1],
      });
      histogram.observe(0.05);
      histogram.observe(0.3);
      histogram.observe(0.8);

      const output = registry.serialize();
      expect(output).toContain('# TYPE request_duration histogram');
      expect(output).toContain('request_duration_bucket{le="0.1"} 1');
      expect(output).toContain('request_duration_bucket{le="0.5"} 2');
      expect(output).toContain('request_duration_bucket{le="1"} 3');
      expect(output).toContain('request_duration_bucket{le="+Inf"} 3');
      expect(output).toContain('request_duration_count 3');
    });

    it('should end with newline', () => {
      registry.createCounter({ name: 'c', help: 'c' });
      const output = registry.serialize();
      expect(output.endsWith('\n')).toBe(true);
    });
  });
});

describe('Metrics Endpoint', () => {
  beforeEach(() => {
    MetricsRegistry.resetInstance();
  });

  it('should return Prometheus content type', () => {
    const response = handleMetricsRequest();
    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe(METRICS_CONTENT_TYPE);
    expect(response.headers['Content-Type']).toBe('text/plain; version=0.0.4; charset=utf-8');
  });

  it('should return serialized metrics in body', () => {
    const registry = MetricsRegistry.getInstance();
    const counter = registry.createCounter({ name: 'endpoint_test', help: 'Test' });
    counter.inc(undefined, 3);

    const response = handleMetricsRequest(registry);
    expect(response.body).toContain('endpoint_test 3');
  });
});

describe('Default Metrics Registration', () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    MetricsRegistry.resetInstance();
    registry = MetricsRegistry.getInstance();
  });

  it('should register request metrics', () => {
    const metrics = registerRequestMetrics(registry);
    expect(metrics.httpRequestsTotal.name).toBe('http_requests_total');
    expect(metrics.httpRequestDurationSeconds.name).toBe('http_request_duration_seconds');
    expect(metrics.httpRequestSizeBytes.name).toBe('http_request_size_bytes');
    expect(metrics.httpResponseSizeBytes.name).toBe('http_response_size_bytes');

    metrics.httpRequestsTotal.inc({ method: 'GET', path: '/api', status: '200' });
    expect(metrics.httpRequestsTotal.get({ method: 'GET', path: '/api', status: '200' })).toBe(1);
  });

  it('should register database metrics', () => {
    const metrics = registerDatabaseMetrics(registry);
    expect(metrics.dbQueriesTotal.name).toBe('db_queries_total');
    expect(metrics.dbQueryDurationSeconds.name).toBe('db_query_duration_seconds');
    expect(metrics.dbConnectionsActive.name).toBe('db_connections_active');

    metrics.dbConnectionsActive.set(5);
    expect(metrics.dbConnectionsActive.get()).toBe(5);
  });

  it('should register cache metrics', () => {
    const metrics = registerCacheMetrics(registry);
    expect(metrics.cacheHitsTotal.name).toBe('cache_hits_total');
    expect(metrics.cacheMissesTotal.name).toBe('cache_misses_total');
    expect(metrics.cacheHitRate.name).toBe('cache_hit_rate');

    metrics.cacheHitsTotal.inc({ cache: 'redis' }, 10);
    metrics.cacheMissesTotal.inc({ cache: 'redis' }, 2);
    metrics.cacheHitRate.set(0.83, { cache: 'redis' });
    expect(metrics.cacheHitRate.get({ cache: 'redis' })).toBeCloseTo(0.83);
  });

  it('should register application metrics', () => {
    const metrics = registerApplicationMetrics(registry);
    expect(metrics.appColdStartsTotal.name).toBe('app_cold_starts_total');
    expect(metrics.appErrorsTotal.name).toBe('app_errors_total');

    metrics.appColdStartsTotal.inc();
    metrics.appErrorsTotal.inc({ type: 'unhandled' });
    expect(metrics.appColdStartsTotal.get()).toBe(1);
    expect(metrics.appErrorsTotal.get({ type: 'unhandled' })).toBe(1);
  });
});
