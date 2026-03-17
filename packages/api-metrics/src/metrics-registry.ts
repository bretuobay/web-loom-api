import type {
  Metric,
  MetricLabels,
  Counter,
  Gauge,
  Histogram,
  Summary,
  CounterOptions,
  GaugeOptions,
  HistogramOptions,
  SummaryOptions,
} from './types';

const DEFAULT_HISTOGRAM_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const DEFAULT_SUMMARY_QUANTILES = [0.5, 0.9, 0.95, 0.99];

function labelsKey(labels?: MetricLabels): string {
  if (!labels || Object.keys(labels).length === 0) return '';
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}="${labels[k]}"`)
    .join(',');
}

function formatLabels(key: string): string {
  if (!key) return '';
  return `{${key}}`;
}




// ---- Internal metric implementations with accessible state ----

class CounterImpl implements Counter {
  readonly type = 'counter' as const;
  readonly name: string;
  readonly help: string;
  readonly _values = new Map<string, number>();

  constructor(options: CounterOptions) {
    this.name = options.name;
    this.help = options.help;
  }

  inc(labels?: MetricLabels, value = 1): void {
    if (value < 0) throw new Error('Counter can only be incremented');
    const key = labelsKey(labels);
    this._values.set(key, (this._values.get(key) ?? 0) + value);
  }

  get(labels?: MetricLabels): number {
    return this._values.get(labelsKey(labels)) ?? 0;
  }

  reset(): void {
    this._values.clear();
  }
}

class GaugeImpl implements Gauge {
  readonly type = 'gauge' as const;
  readonly name: string;
  readonly help: string;
  readonly _values = new Map<string, number>();

  constructor(options: GaugeOptions) {
    this.name = options.name;
    this.help = options.help;
  }

  set(value: number, labels?: MetricLabels): void {
    this._values.set(labelsKey(labels), value);
  }

  inc(labels?: MetricLabels, value = 1): void {
    const key = labelsKey(labels);
    this._values.set(key, (this._values.get(key) ?? 0) + value);
  }

  dec(labels?: MetricLabels, value = 1): void {
    const key = labelsKey(labels);
    this._values.set(key, (this._values.get(key) ?? 0) - value);
  }

  get(labels?: MetricLabels): number {
    return this._values.get(labelsKey(labels)) ?? 0;
  }

  reset(): void {
    this._values.clear();
  }
}

interface HistogramData {
  bucketCounts: number[];
  sum: number;
  count: number;
}

class HistogramImpl implements Histogram {
  readonly type = 'histogram' as const;
  readonly name: string;
  readonly help: string;
  readonly buckets: number[];
  readonly _data = new Map<string, HistogramData>();

  constructor(options: HistogramOptions) {
    this.name = options.name;
    this.help = options.help;
    this.buckets = (options.buckets ?? DEFAULT_HISTOGRAM_BUCKETS).slice().sort((a, b) => a - b);
  }

  observe(value: number, labels?: MetricLabels): void {
    const key = labelsKey(labels);
    let d = this._data.get(key);
    if (!d) {
      d = { bucketCounts: new Array(this.buckets.length).fill(0), sum: 0, count: 0 };
      this._data.set(key, d);
    }
    d.sum += value;
    d.count += 1;
    // Store per-bucket (non-cumulative); serialization makes them cumulative
    for (let i = 0; i < this.buckets.length; i++) {
      const bucket = this.buckets[i];
      if (bucket !== undefined && value <= bucket) {
        d.bucketCounts[i] = (d.bucketCounts[i] ?? 0) + 1;
        break;
      }
    }
  }

  reset(): void {
    this._data.clear();
  }
}

interface SummaryData {
  values: number[];
  sum: number;
  count: number;
}

class SummaryImpl implements Summary {
  readonly type = 'summary' as const;
  readonly name: string;
  readonly help: string;
  readonly quantiles: number[];
  readonly _data = new Map<string, SummaryData>();

  constructor(options: SummaryOptions) {
    this.name = options.name;
    this.help = options.help;
    this.quantiles = options.quantiles ?? DEFAULT_SUMMARY_QUANTILES;
  }

  observe(value: number, labels?: MetricLabels): void {
    const key = labelsKey(labels);
    let d = this._data.get(key);
    if (!d) {
      d = { values: [], sum: 0, count: 0 };
      this._data.set(key, d);
    }
    d.values.push(value);
    d.sum += value;
    d.count += 1;
  }

  reset(): void {
    this._data.clear();
  }
}


// ---- Prometheus serialization helpers ----

function serializeCounter(metric: CounterImpl): string[] {
  const lines: string[] = [];
  if (metric._values.size === 0) {
    lines.push(`${metric.name} 0`);
  } else {
    for (const [key, value] of metric._values) {
      lines.push(`${metric.name}${formatLabels(key)} ${value}`);
    }
  }
  return lines;
}

function serializeGauge(metric: GaugeImpl): string[] {
  const lines: string[] = [];
  if (metric._values.size === 0) {
    lines.push(`${metric.name} 0`);
  } else {
    for (const [key, value] of metric._values) {
      lines.push(`${metric.name}${formatLabels(key)} ${value}`);
    }
  }
  return lines;
}

function serializeHistogram(metric: HistogramImpl): string[] {
  const lines: string[] = [];
  if (metric._data.size === 0) {
    for (const b of metric.buckets) {
      lines.push(`${metric.name}_bucket{le="${b}"} 0`);
    }
    lines.push(`${metric.name}_bucket{le="+Inf"} 0`);
    lines.push(`${metric.name}_sum 0`);
    lines.push(`${metric.name}_count 0`);
  } else {
    for (const [key, data] of metric._data) {
      const labelPrefix = key ? key + ',' : '';
      let cumulative = 0;
      for (let i = 0; i < metric.buckets.length; i++) {
        cumulative += (data.bucketCounts[i] ?? 0);
        lines.push(`${metric.name}_bucket{${labelPrefix}le="${(metric.buckets[i] ?? 0)}"} ${cumulative}`);
      }
      lines.push(`${metric.name}_bucket{${labelPrefix}le="+Inf"} ${data.count}`);
      lines.push(`${metric.name}_sum${formatLabels(key)} ${data.sum}`);
      lines.push(`${metric.name}_count${formatLabels(key)} ${data.count}`);
    }
  }
  return lines;
}

function calculateQuantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = q * (sorted.length - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return (sorted[lower] ?? 0);
  return (sorted[lower] ?? 0) + (pos - lower) * ((sorted[upper] ?? 0) - (sorted[lower] ?? 0));
}

function serializeSummary(metric: SummaryImpl): string[] {
  const lines: string[] = [];
  if (metric._data.size === 0) {
    for (const q of metric.quantiles) {
      lines.push(`${metric.name}{quantile="${q}"} 0`);
    }
    lines.push(`${metric.name}_sum 0`);
    lines.push(`${metric.name}_count 0`);
  } else {
    for (const [key, data] of metric._data) {
      const sorted = data.values.slice().sort((a, b) => a - b);
      const labelPrefix = key ? key + ',' : '';
      for (const q of metric.quantiles) {
        const value = calculateQuantile(sorted, q);
        lines.push(`${metric.name}{${labelPrefix}quantile="${q}"} ${value}`);
      }
      lines.push(`${metric.name}_sum${formatLabels(key)} ${data.sum}`);
      lines.push(`${metric.name}_count${formatLabels(key)} ${data.count}`);
    }
  }
  return lines;
}


// ---- MetricsRegistry (singleton) ----

/**
 * Singleton registry for all application metrics.
 * Supports counter, gauge, histogram, and summary metric types.
 * Serializes to Prometheus text exposition format.
 */
export class MetricsRegistry {
  private static instance: MetricsRegistry | null = null;
  private metrics = new Map<string, Metric>();

  private constructor() {}

  static getInstance(): MetricsRegistry {
    if (!MetricsRegistry.instance) {
      MetricsRegistry.instance = new MetricsRegistry();
    }
    return MetricsRegistry.instance;
  }

  /** Reset singleton — useful for testing. */
  static resetInstance(): void {
    MetricsRegistry.instance = null;
  }

  createCounter(options: CounterOptions): Counter {
    if (this.metrics.has(options.name)) {
      const existing = this.metrics.get(options.name)!;
      if (existing.type !== 'counter') throw new Error(`Metric "${options.name}" already exists as ${existing.type}`);
      return existing as Counter;
    }
    const counter = new CounterImpl(options);
    this.metrics.set(options.name, counter);
    return counter;
  }

  createGauge(options: GaugeOptions): Gauge {
    if (this.metrics.has(options.name)) {
      const existing = this.metrics.get(options.name)!;
      if (existing.type !== 'gauge') throw new Error(`Metric "${options.name}" already exists as ${existing.type}`);
      return existing as Gauge;
    }
    const gauge = new GaugeImpl(options);
    this.metrics.set(options.name, gauge);
    return gauge;
  }

  createHistogram(options: HistogramOptions): Histogram {
    if (this.metrics.has(options.name)) {
      const existing = this.metrics.get(options.name)!;
      if (existing.type !== 'histogram') throw new Error(`Metric "${options.name}" already exists as ${existing.type}`);
      return existing as Histogram;
    }
    const histogram = new HistogramImpl(options);
    this.metrics.set(options.name, histogram);
    return histogram;
  }

  createSummary(options: SummaryOptions): Summary {
    if (this.metrics.has(options.name)) {
      const existing = this.metrics.get(options.name)!;
      if (existing.type !== 'summary') throw new Error(`Metric "${options.name}" already exists as ${existing.type}`);
      return existing as Summary;
    }
    const summary = new SummaryImpl(options);
    this.metrics.set(options.name, summary);
    return summary;
  }

  getMetric(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  getAll(): Map<string, Metric> {
    return new Map(this.metrics);
  }

  reset(): void {
    for (const metric of this.metrics.values()) {
      metric.reset();
    }
  }

  clear(): void {
    this.metrics.clear();
  }

  /**
   * Serialize all metrics to Prometheus text exposition format.
   */
  serialize(): string {
    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      if (metric instanceof CounterImpl) {
        lines.push(...serializeCounter(metric));
      } else if (metric instanceof GaugeImpl) {
        lines.push(...serializeGauge(metric));
      } else if (metric instanceof HistogramImpl) {
        lines.push(...serializeHistogram(metric));
      } else if (metric instanceof SummaryImpl) {
        lines.push(...serializeSummary(metric));
      }
    }

    return lines.join('\n') + (lines.length > 0 ? '\n' : '');
  }
}
