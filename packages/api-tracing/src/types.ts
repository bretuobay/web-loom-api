// ============================================================================
// Span Status Codes (OpenTelemetry-compatible)
// ============================================================================

export enum SpanStatusCode {
  UNSET = 0,
  OK = 1,
  ERROR = 2,
}

// ============================================================================
// Sampling Decision
// ============================================================================

export enum SamplingDecision {
  DROP = 0,
  RECORD_AND_SAMPLE = 1,
}

// ============================================================================
// Interfaces
// ============================================================================

export interface SpanStatus {
  code: SpanStatusCode;
  message?: string;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, SpanAttributeValue>;
}

export type SpanAttributeValue = string | number | boolean;

export interface SpanOptions {
  parentSpanId?: string;
  traceId?: string;
  attributes?: Record<string, SpanAttributeValue>;
}

export interface SpanData {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  status: SpanStatus;
  attributes: Record<string, SpanAttributeValue>;
  events: SpanEvent[];
}

export interface TracerOptions {
  serviceName?: string;
  sampler?: Sampler;
  onSpanEnd?: (span: SpanData) => void;
}

export interface SamplingResult {
  decision: SamplingDecision;
  attributes?: Record<string, SpanAttributeValue>;
}

export interface Sampler {
  shouldSample(
    traceId: string,
    spanName: string,
    attributes?: Record<string, SpanAttributeValue>
  ): SamplingResult;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  traceState?: string;
}

export interface TracingMiddlewareOptions {
  tracer: TracerInterface;
  /** Paths to exclude from tracing */
  excludePaths?: string[];
}

export interface TracerInterface {
  createSpan(name: string, options?: SpanOptions): SpanData & SpanMethods;
  startSpan<T>(name: string, fn: (span: SpanData & SpanMethods) => T): T;
  getActiveSpan(): (SpanData & SpanMethods) | undefined;
  configure(options: TracerOptions): void;
}

export interface SpanMethods {
  setAttribute(key: string, value: SpanAttributeValue): void;
  addEvent(name: string, attributes?: Record<string, SpanAttributeValue>): void;
  setStatus(code: SpanStatusCode, message?: string): void;
  end(): void;
}
