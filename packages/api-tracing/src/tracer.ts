import { Span, generateTraceId } from './span';
import { AlwaysSampler } from './sampler';
import {
  SpanStatusCode,
  type TracerOptions,
  type SpanOptions,
  type TracerInterface,
  type SpanData,
  type Sampler,
} from './types';

/**
 * Distributed tracer that creates and manages spans.
 */
export class Tracer implements TracerInterface {
  private serviceName: string;
  private sampler: Sampler;
  private onSpanEnd?: (span: SpanData) => void;
  private activeSpan: Span | undefined;

  constructor(options: TracerOptions = {}) {
    this.serviceName = options.serviceName ?? 'unknown-service';
    this.sampler = options.sampler ?? new AlwaysSampler();
    if (options.onSpanEnd !== undefined) this.onSpanEnd = options.onSpanEnd;
  }

  configure(options: TracerOptions): void {
    if (options.serviceName !== undefined) this.serviceName = options.serviceName;
    if (options.sampler !== undefined) this.sampler = options.sampler;
    if (options.onSpanEnd !== undefined) this.onSpanEnd = options.onSpanEnd;
  }

  createSpan(name: string, options?: SpanOptions): Span {
    const traceId = options?.traceId ?? this.activeSpan?.traceId ?? generateTraceId();
    const parentSpanId = options?.parentSpanId ?? this.activeSpan?.spanId;

    const spanOpts: SpanOptions & { onEnd?: (span: SpanData) => void } = {
      traceId,
      attributes: {
        'service.name': this.serviceName,
        ...options?.attributes,
      },
    };
    if (parentSpanId !== undefined) spanOpts.parentSpanId = parentSpanId;
    if (this.onSpanEnd !== undefined) {
      const handler = this.onSpanEnd;
      spanOpts.onEnd = (spanData: SpanData) => handler(spanData);
    }
    const span = new Span(name, spanOpts);

    return span;
  }


  startSpan<T>(name: string, fn: (span: Span) => T): T {
    const span = this.createSpan(name);
    const previousSpan = this.activeSpan;
    this.activeSpan = span;

    try {
      const result = fn(span);
      if (!span.endTime) {
        span.setStatus(SpanStatusCode.OK);
        span.end();
      }
      return result;
    } catch (error) {
      span.setStatus(SpanStatusCode.ERROR, error instanceof Error ? error.message : String(error));
      span.addEvent('exception', {
        'exception.type': error instanceof Error ? error.constructor.name : 'Error',
        'exception.message': error instanceof Error ? error.message : String(error),
      });
      span.end();
      throw error;
    } finally {
      this.activeSpan = previousSpan;
    }
  }

  getActiveSpan(): Span | undefined {
    return this.activeSpan;
  }

  getSampler(): Sampler {
    return this.sampler;
  }

  /**
   * Create a span for a database query.
   */
  createDbSpan(operation: string, table: string): Span {
    return this.createSpan(`db.${operation} ${table}`, {
      attributes: {
        'db.system': 'sql',
        'db.operation': operation,
        'db.table': table,
      },
    });
  }

  /**
   * Create a span for an external HTTP call.
   */
  createHttpSpan(method: string, url: string): Span {
    return this.createSpan(`HTTP ${method} ${url}`, {
      attributes: {
        'http.method': method,
        'http.url': url,
      },
    });
  }
}
