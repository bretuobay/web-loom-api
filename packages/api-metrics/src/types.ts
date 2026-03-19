/**
 * Metric types supported by the registry.
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Labels are key-value pairs attached to metric observations.
 */
export type MetricLabels = Record<string, string>;

/**
 * Options for creating a counter metric.
 */
export interface CounterOptions {
  name: string;
  help: string;
  labelNames?: string[];
}

/**
 * Options for creating a gauge metric.
 */
export interface GaugeOptions {
  name: string;
  help: string;
  labelNames?: string[];
}

/**
 * Options for creating a histogram metric.
 */
export interface HistogramOptions {
  name: string;
  help: string;
  labelNames?: string[];
  buckets?: number[];
}

/**
 * Options for creating a summary metric.
 */
export interface SummaryOptions {
  name: string;
  help: string;
  labelNames?: string[];
  quantiles?: number[];
  maxAge?: number;
}

/**
 * Counter metric interface — monotonically increasing value.
 */
export interface Counter {
  type: 'counter';
  name: string;
  help: string;
  inc(labels?: MetricLabels, value?: number): void;
  get(labels?: MetricLabels): number;
  reset(): void;
}

/**
 * Gauge metric interface — value that can go up and down.
 */
export interface Gauge {
  type: 'gauge';
  name: string;
  help: string;
  set(value: number, labels?: MetricLabels): void;
  inc(labels?: MetricLabels, value?: number): void;
  dec(labels?: MetricLabels, value?: number): void;
  get(labels?: MetricLabels): number;
  reset(): void;
}

/**
 * Histogram metric interface — observations bucketed by value.
 */
export interface Histogram {
  type: 'histogram';
  name: string;
  help: string;
  buckets: number[];
  observe(value: number, labels?: MetricLabels): void;
  reset(): void;
}

/**
 * Summary metric interface — observations with quantile calculation.
 */
export interface Summary {
  type: 'summary';
  name: string;
  help: string;
  quantiles: number[];
  observe(value: number, labels?: MetricLabels): void;
  reset(): void;
}

export type Metric = Counter | Gauge | Histogram | Summary;

/**
 * Metrics endpoint response shape.
 */
export interface MetricsEndpointResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
