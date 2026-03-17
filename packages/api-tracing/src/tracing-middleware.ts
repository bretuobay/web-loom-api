import { Tracer } from './tracer';
import { Span } from './span';
import { extractTraceContext, injectTraceContext } from './context';
import { SpanStatusCode, type TracingMiddlewareOptions } from './types';

export interface SimpleRequest {
  method: string;
  url: string;
  headers: Record<string, string | undefined>;
}

export interface SimpleResponse {
  statusCode: number;
  headers: Record<string, string>;
}

/**
 * Creates a tracing middleware function that wraps request handling.
 * Creates a root span for each request, propagates trace context,
 * and records duration and status.
 */
export function createTracingMiddleware(options: TracingMiddlewareOptions) {
  const tracer = options.tracer as Tracer;
  const excludePaths = new Set(options.excludePaths ?? []);

  return function tracingMiddleware(
    req: SimpleRequest,
    res: SimpleResponse,
    next: (error?: Error) => void,
  ): void {
    // Skip excluded paths
    if (excludePaths.has(req.url)) {
      next();
      return;
    }

    // Extract incoming trace context
    const parentCtx = extractTraceContext(req.headers);

    // Create root span for this request
    const span = tracer.createSpan(`${req.method} ${req.url}`, {
      traceId: parentCtx?.traceId,
      parentSpanId: parentCtx?.spanId,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
      },
    });


    // Inject trace context into response headers
    injectTraceContext(
      { traceId: span.traceId, spanId: span.spanId, traceFlags: 1 },
      res.headers,
    );

    // Wrap next to capture completion
    const originalNext = next;
    const wrappedNext = (error?: Error) => {
      span.setAttribute('http.status_code', res.statusCode);

      if (error) {
        span.setStatus(SpanStatusCode.ERROR, error.message);
        span.addEvent('exception', {
          'exception.type': error.constructor.name,
          'exception.message': error.message,
        });
      } else if (res.statusCode >= 400) {
        span.setStatus(SpanStatusCode.ERROR, `HTTP ${res.statusCode}`);
      } else {
        span.setStatus(SpanStatusCode.OK);
      }

      span.end();
      originalNext(error);
    };

    wrappedNext();
  };
}
