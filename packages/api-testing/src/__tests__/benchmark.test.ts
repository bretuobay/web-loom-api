import { describe, it, expect } from 'vitest';
import {
  benchmark,
  benchmarkColdStart,
  benchmarkLatency,
  benchmarkThroughput,
  formatBenchmarkReport,
} from '../benchmark';
import type { BenchmarkResult } from '../benchmark';
import type { RequestHandler } from '../types';

// Simple mock handler for testing
const mockHandler: RequestHandler = async (req) => ({
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ok: true }),
});

describe('benchmark', () => {
  it('should run a function and return timing stats', async () => {
    let count = 0;
    const result = await benchmark('test-fn', () => { count++; }, {
      iterations: 20,
      warmup: 2,
    });

    expect(result.name).toBe('test-fn');
    expect(result.iterations).toBe(20);
    expect(result.totalMs).toBeGreaterThanOrEqual(0);
    expect(result.avgMs).toBeGreaterThanOrEqual(0);
    expect(result.minMs).toBeGreaterThanOrEqual(0);
    expect(result.maxMs).toBeGreaterThanOrEqual(result.minMs);
    expect(result.p50Ms).toBeGreaterThanOrEqual(0);
    expect(result.p95Ms).toBeGreaterThanOrEqual(0);
    expect(result.p99Ms).toBeGreaterThanOrEqual(0);
    expect(result.opsPerSecond).toBeGreaterThan(0);
    // warmup (2) + iterations (20)
    expect(count).toBe(22);
  });

  it('should handle async functions', async () => {
    const result = await benchmark(
      'async-fn',
      async () => { await new Promise((r) => setTimeout(r, 1)); },
      { iterations: 5, warmup: 1 }
    );

    expect(result.name).toBe('async-fn');
    expect(result.iterations).toBe(5);
    expect(result.avgMs).toBeGreaterThan(0);
  });

  it('should use default options when none provided', async () => {
    const result = await benchmark('defaults', () => {}, {
      iterations: 10,
      warmup: 0,
    });

    expect(result.iterations).toBe(10);
  });

  it('should respect timeout', async () => {
    const result = await benchmark(
      'timeout-test',
      async () => { await new Promise((r) => setTimeout(r, 50)); },
      { iterations: 1000, warmup: 0, timeout: 200 }
    );

    // Should complete fewer than 1000 iterations due to timeout
    expect(result.iterations).toBeLessThan(1000);
    expect(result.iterations).toBeGreaterThan(0);
  });
});

describe('benchmarkColdStart', () => {
  it('should measure initialization time', async () => {
    const result = await benchmarkColdStart(async () => {
      // Simulate some initialization work
      const arr: number[] = [];
      for (let i = 0; i < 10000; i++) arr.push(i);
    });

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.memoryUsedMB).toBe('number');
  });

  it('should measure sync initialization', async () => {
    const result = await benchmarkColdStart(() => {
      const _x = Array.from({ length: 1000 }, (_, i) => i);
    });

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.memoryUsedMB).toBe('number');
  });
});

describe('benchmarkLatency', () => {
  it('should measure latency for multiple requests', async () => {
    const result = await benchmarkLatency(mockHandler, [
      { method: 'GET', path: '/api/users' },
      { method: 'POST', path: '/api/users', body: { name: 'test' } },
    ]);

    expect(result.results).toHaveLength(2);
    expect(result.results[0].name).toBe('GET /api/users');
    expect(result.results[1].name).toBe('POST /api/users');
    expect(result.summary.avgMs).toBeGreaterThanOrEqual(0);
    expect(result.summary.p50Ms).toBeGreaterThanOrEqual(0);
    expect(result.summary.p95Ms).toBeGreaterThanOrEqual(0);
    expect(result.summary.p99Ms).toBeGreaterThanOrEqual(0);
  });

  it('should pass headers to handler', async () => {
    let receivedHeaders: Record<string, string> = {};
    const handler: RequestHandler = async (req) => {
      receivedHeaders = req.headers;
      return { status: 200, headers: {}, body: '' };
    };

    await benchmarkLatency(handler, [
      { method: 'GET', path: '/test', headers: { authorization: 'Bearer tok' } },
    ]);

    expect(receivedHeaders.authorization).toBe('Bearer tok');
  });
});

describe('benchmarkThroughput', () => {
  it('should measure requests per second', async () => {
    const result = await benchmarkThroughput(
      mockHandler,
      { method: 'GET', path: '/api/health' },
      { durationMs: 200, concurrency: 1 }
    );

    expect(result.requestsPerSecond).toBeGreaterThan(0);
    expect(result.totalRequests).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.errors).toBe(0);
    expect(result.latency.avgMs).toBeGreaterThanOrEqual(0);
    expect(result.latency.p50Ms).toBeGreaterThanOrEqual(0);
    expect(result.latency.p95Ms).toBeGreaterThanOrEqual(0);
    expect(result.latency.p99Ms).toBeGreaterThanOrEqual(0);
  });

  it('should count errors from failing handlers', async () => {
    const failHandler: RequestHandler = async () => {
      throw new Error('fail');
    };

    const result = await benchmarkThroughput(
      failHandler,
      { method: 'GET', path: '/fail' },
      { durationMs: 100, concurrency: 1 }
    );

    expect(result.errors).toBeGreaterThan(0);
    expect(result.totalRequests).toBeGreaterThan(0);
  });

  it('should support concurrency', async () => {
    const result = await benchmarkThroughput(
      mockHandler,
      { method: 'GET', path: '/api/health' },
      { durationMs: 200, concurrency: 3 }
    );

    expect(result.requestsPerSecond).toBeGreaterThan(0);
    expect(result.totalRequests).toBeGreaterThan(0);
  });
});

describe('formatBenchmarkReport', () => {
  it('should format results as a table', () => {
    const results: BenchmarkResult[] = [
      {
        name: 'test-1',
        iterations: 100,
        totalMs: 50,
        avgMs: 0.5,
        minMs: 0.1,
        maxMs: 2.0,
        p50Ms: 0.4,
        p95Ms: 1.5,
        p99Ms: 1.9,
        opsPerSecond: 2000,
      },
    ];

    const report = formatBenchmarkReport(results);
    expect(report).toContain('Name');
    expect(report).toContain('Iterations');
    expect(report).toContain('Avg (ms)');
    expect(report).toContain('Ops/sec');
    expect(report).toContain('test-1');
    expect(report).toContain('100');
    expect(report).toContain('2000');
  });

  it('should return message for empty results', () => {
    const report = formatBenchmarkReport([]);
    expect(report).toBe('No benchmark results.');
  });

  it('should handle multiple results', () => {
    const results: BenchmarkResult[] = [
      {
        name: 'a', iterations: 10, totalMs: 5, avgMs: 0.5,
        minMs: 0.1, maxMs: 1, p50Ms: 0.4, p95Ms: 0.9, p99Ms: 1, opsPerSecond: 2000,
      },
      {
        name: 'b', iterations: 20, totalMs: 10, avgMs: 0.5,
        minMs: 0.2, maxMs: 1.5, p50Ms: 0.5, p95Ms: 1.2, p99Ms: 1.4, opsPerSecond: 2000,
      },
    ];

    const report = formatBenchmarkReport(results);
    const lines = report.split('\n');
    // header + separator + 2 data rows
    expect(lines).toHaveLength(4);
  });
});
