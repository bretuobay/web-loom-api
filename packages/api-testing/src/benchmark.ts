/**
 * Benchmarking utilities for @web-loom/api-testing
 */
import type { RequestHandler } from './types';

// ---- Types ----

export interface BenchmarkOptions {
  iterations?: number;
  warmup?: number;
  timeout?: number;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  opsPerSecond: number;
}

export interface ColdStartResult {
  durationMs: number;
  memoryUsedMB: number;
}

export interface LatencyResult {
  results: BenchmarkResult[];
  summary: { avgMs: number; p50Ms: number; p95Ms: number; p99Ms: number };
}

export interface BenchmarkRequest {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ThroughputOptions {
  durationMs?: number;
  concurrency?: number;
}

export interface ThroughputResult {
  requestsPerSecond: number;
  totalRequests: number;
  durationMs: number;
  errors: number;
  latency: { avgMs: number; p50Ms: number; p95Ms: number; p99Ms: number };
}

// ---- Helpers ----

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

function computeStats(timings: number[]): {
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
} {
  const sorted = [...timings].sort((a, b) => a - b);
  const total = sorted.reduce((sum, t) => sum + t, 0);
  return {
    avgMs: round(total / sorted.length),
    minMs: round(sorted[0] ?? 0),
    maxMs: round(sorted[sorted.length - 1] ?? 0),
    p50Ms: round(percentile(sorted, 50)),
    p95Ms: round(percentile(sorted, 95)),
    p99Ms: round(percentile(sorted, 99)),
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function hrtimeMs(): number {
  const [s, ns] = process.hrtime();
  return s * 1000 + ns / 1e6;
}

// ---- Core Functions ----

/**
 * Run a function multiple times and collect timing statistics.
 */
export async function benchmark(
  name: string,
  fn: () => void | Promise<void>,
  options?: BenchmarkOptions
): Promise<BenchmarkResult> {
  const iterations = options?.iterations ?? 100;
  const warmup = options?.warmup ?? 10;
  const timeout = options?.timeout ?? 30000;

  // Warmup phase
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  const timings: number[] = [];
  const deadline = hrtimeMs() + timeout;

  for (let i = 0; i < iterations; i++) {
    if (hrtimeMs() > deadline) break;
    const start = hrtimeMs();
    await fn();
    timings.push(hrtimeMs() - start);
  }

  const totalMs = round(timings.reduce((sum, t) => sum + t, 0));
  const stats = computeStats(timings);

  return {
    name,
    iterations: timings.length,
    totalMs,
    avgMs: stats.avgMs,
    minMs: stats.minMs,
    maxMs: stats.maxMs,
    p50Ms: stats.p50Ms,
    p95Ms: stats.p95Ms,
    p99Ms: stats.p99Ms,
    opsPerSecond: round(timings.length / (totalMs / 1000)),
  };
}

/**
 * Measure cold start time for an initialization function.
 */
export async function benchmarkColdStart(
  initFn: () => void | Promise<void>
): Promise<ColdStartResult> {
  const memBefore = process.memoryUsage().heapUsed;
  const start = hrtimeMs();
  await initFn();
  const durationMs = round(hrtimeMs() - start);
  const memAfter = process.memoryUsage().heapUsed;
  const memoryUsedMB = round((memAfter - memBefore) / (1024 * 1024));

  return { durationMs, memoryUsedMB };
}

/**
 * Send multiple requests to a handler and measure latency distribution.
 */
export async function benchmarkLatency(
  handler: RequestHandler,
  requests: BenchmarkRequest[]
): Promise<LatencyResult> {
  const results: BenchmarkResult[] = [];

  for (const req of requests) {
    const result = await benchmark(
      `${req.method} ${req.path}`,
      async () => {
        const reqObj: {
          method: string;
          url: string;
          headers: Record<string, string>;
          body?: string;
        } = {
          method: req.method,
          url: req.path,
          headers: req.headers ?? {},
        };
        if (req.body !== undefined) reqObj.body = JSON.stringify(req.body);
        await handler(reqObj);
      },
      { iterations: 100, warmup: 5 }
    );
    results.push(result);
  }

  const allAvg = results.map((r) => r.avgMs);
  const allP50 = results.map((r) => r.p50Ms);
  const allP95 = results.map((r) => r.p95Ms);
  const allP99 = results.map((r) => r.p99Ms);

  const avg = (arr: number[]) => round(arr.reduce((s, v) => s + v, 0) / arr.length);

  return {
    results,
    summary: {
      avgMs: avg(allAvg),
      p50Ms: avg(allP50),
      p95Ms: avg(allP95),
      p99Ms: avg(allP99),
    },
  };
}

/**
 * Measure requests per second for a handler.
 */
export async function benchmarkThroughput(
  handler: RequestHandler,
  request: BenchmarkRequest,
  options?: ThroughputOptions
): Promise<ThroughputResult> {
  const durationMs = options?.durationMs ?? 5000;
  const concurrency = options?.concurrency ?? 1;

  const timings: number[] = [];
  let errors = 0;
  const deadline = hrtimeMs() + durationMs;

  async function worker(): Promise<void> {
    while (hrtimeMs() < deadline) {
      const start = hrtimeMs();
      try {
        const stressReq: {
          method: string;
          url: string;
          headers: Record<string, string>;
          body?: string;
        } = {
          method: request.method,
          url: request.path,
          headers: request.headers ?? {},
        };
        if (request.body !== undefined) stressReq.body = JSON.stringify(request.body);
        await handler(stressReq);
      } catch {
        errors++;
      }
      timings.push(hrtimeMs() - start);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const actualDuration = timings.reduce((s, t) => s + t, 0);
  const stats = computeStats(timings);

  return {
    requestsPerSecond: round(timings.length / (actualDuration / 1000)),
    totalRequests: timings.length,
    durationMs: round(actualDuration),
    errors,
    latency: {
      avgMs: stats.avgMs,
      p50Ms: stats.p50Ms,
      p95Ms: stats.p95Ms,
      p99Ms: stats.p99Ms,
    },
  };
}

/**
 * Pretty-print benchmark results as a formatted table.
 */
export function formatBenchmarkReport(results: BenchmarkResult[]): string {
  if (results.length === 0) return 'No benchmark results.';

  const header = [
    'Name',
    'Iterations',
    'Avg (ms)',
    'Min (ms)',
    'Max (ms)',
    'P50 (ms)',
    'P95 (ms)',
    'P99 (ms)',
    'Ops/sec',
  ];

  const rows = results.map((r) => [
    r.name,
    String(r.iterations),
    String(r.avgMs),
    String(r.minMs),
    String(r.maxMs),
    String(r.p50Ms),
    String(r.p95Ms),
    String(r.p99Ms),
    String(r.opsPerSecond),
  ]);

  const colWidths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length))
  );

  const pad = (s: string, w: number) => s.padEnd(w);
  const sep = colWidths.map((w) => '-'.repeat(w)).join(' | ');

  const headerLine = header.map((h, i) => pad(h, colWidths[i] ?? 0)).join(' | ');
  const dataLines = rows.map((row) =>
    row.map((cell, i) => pad(cell, colWidths[i] ?? 0)).join(' | ')
  );

  return [headerLine, sep, ...dataLines].join('\n');
}
