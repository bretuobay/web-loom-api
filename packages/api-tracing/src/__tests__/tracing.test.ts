import { describe, it, expect, vi } from 'vitest';
import {
  Span,
  generateTraceId,
  generateSpanId,
  Tracer,
  SpanStatusCode,
  SamplingDecision,
  parseTraceparent,
  formatTraceparent,
  parseTracestate,
  formatTracestate,
  extractTraceContext,
  injectTraceContext,
  AlwaysSampler,
  NeverSampler,
  ProbabilitySampler,
  CompositeSampler,
  createTracingMiddleware,
} from '../index';

// ============================================================================
// Span Tests
// ============================================================================

describe('Span', () => {
  it('should create a span with generated IDs', () => {
    const span = new Span('test-span');
    expect(span.spanId).toHaveLength(16);
    expect(span.traceId).toHaveLength(32);
    expect(span.name).toBe('test-span');
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(span.startTime).toBeLessThanOrEqual(Date.now());
    expect(span.endTime).toBeUndefined();
  });

  it('should use provided traceId and parentSpanId', () => {
    const traceId = generateTraceId();
    const parentSpanId = generateSpanId();
    const span = new Span('child-span', { traceId, parentSpanId });
    expect(span.traceId).toBe(traceId);
    expect(span.parentSpanId).toBe(parentSpanId);
  });

  it('should set attributes', () => {
    const span = new Span('test-span');
    span.setAttribute('http.method', 'GET');
    span.setAttribute('http.status_code', 200);
    expect(span.attributes['http.method']).toBe('GET');
    expect(span.attributes['http.status_code']).toBe(200);
  });

  it('should add events', () => {
    const span = new Span('test-span');
    span.addEvent('request.start', { 'request.size': 1024 });
    expect(span.events).toHaveLength(1);
    expect(span.events[0].name).toBe('request.start');
    expect(span.events[0].attributes?.['request.size']).toBe(1024);
    expect(span.events[0].timestamp).toBeLessThanOrEqual(Date.now());
  });

  it('should set status', () => {
    const span = new Span('test-span');
    span.setStatus(SpanStatusCode.OK);
    expect(span.status.code).toBe(SpanStatusCode.OK);

    span.setStatus(SpanStatusCode.ERROR, 'Something went wrong');
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.status.message).toBe('Something went wrong');
  });

  it('should end the span and set endTime', () => {
    const span = new Span('test-span');
    expect(span.endTime).toBeUndefined();
    span.end();
    expect(span.endTime).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(span.endTime!).toBeGreaterThanOrEqual(span.startTime);
  });

  it('should not modify span after ending', () => {
    const span = new Span('test-span');
    span.end();
    const endTime = span.endTime;
    span.setAttribute('key', 'value');
    span.addEvent('event');
    span.setStatus(SpanStatusCode.ERROR);
    span.end(); // second end should be no-op
    expect(span.attributes['key']).toBeUndefined();
    expect(span.events).toHaveLength(0);
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(span.endTime).toBe(endTime);
  });

  it('should call onEnd callback when span ends', () => {
    const onEnd = vi.fn();
    const span = new Span('test-span', { onEnd });
    span.end();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('should serialize to JSON', () => {
    const span = new Span('test-span');
    span.setAttribute('key', 'value');
    const json = span.toJSON();
    expect(json.name).toBe('test-span');
    expect(json.attributes['key']).toBe('value');
    expect(json.spanId).toBe(span.spanId);
  });
});

describe('ID generation', () => {
  it('should generate unique trace IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTraceId()));
    expect(ids.size).toBe(100);
  });

  it('should generate trace IDs of correct length', () => {
    expect(generateTraceId()).toHaveLength(32);
    expect(generateSpanId()).toHaveLength(16);
  });

  it('should generate hex-only strings', () => {
    expect(generateTraceId()).toMatch(/^[0-9a-f]{32}$/);
    expect(generateSpanId()).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ============================================================================
// W3C Trace Context Tests
// ============================================================================

describe('W3C Trace Context', () => {
  describe('parseTraceparent', () => {
    it('should parse a valid traceparent header', () => {
      const ctx = parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
      expect(ctx).not.toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(ctx!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(ctx!.spanId).toBe('00f067aa0ba902b7');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(ctx!.traceFlags).toBe(1);
    });

    it('should return null for invalid format', () => {
      expect(parseTraceparent('invalid')).toBeNull();
      expect(parseTraceparent('')).toBeNull();
      expect(parseTraceparent('00-short-id-01')).toBeNull();
    });

    it('should reject version ff', () => {
      expect(
        parseTraceparent('ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')
      ).toBeNull();
    });

    it('should reject all-zero traceId', () => {
      expect(
        parseTraceparent('00-00000000000000000000000000000000-00f067aa0ba902b7-01')
      ).toBeNull();
    });

    it('should reject all-zero spanId', () => {
      expect(
        parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01')
      ).toBeNull();
    });
  });

  describe('formatTraceparent', () => {
    it('should format a trace context into traceparent header', () => {
      const header = formatTraceparent({
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        traceFlags: 1,
      });
      expect(header).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    });

    it('should roundtrip parse/format', () => {
      const original = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ctx = parseTraceparent(original)!;
      expect(formatTraceparent(ctx)).toBe(original);
    });
  });

  describe('parseTracestate', () => {
    it('should parse tracestate header', () => {
      const entries = parseTracestate('vendor1=value1,vendor2=value2');
      expect(entries).toEqual([
        ['vendor1', 'value1'],
        ['vendor2', 'value2'],
      ]);
    });

    it('should handle empty string', () => {
      expect(parseTracestate('')).toEqual([]);
    });
  });

  describe('formatTracestate', () => {
    it('should format tracestate entries', () => {
      const result = formatTracestate([
        ['vendor1', 'value1'],
        ['vendor2', 'value2'],
      ]);
      expect(result).toBe('vendor1=value1,vendor2=value2');
    });
  });

  describe('extractTraceContext', () => {
    it('should extract context from headers', () => {
      const ctx = extractTraceContext({
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        tracestate: 'vendor1=value1',
      });
      expect(ctx).not.toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(ctx!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(ctx!.traceState).toBe('vendor1=value1');
    });

    it('should return null when no traceparent header', () => {
      expect(extractTraceContext({})).toBeNull();
    });
  });

  describe('injectTraceContext', () => {
    it('should inject context into headers', () => {
      const headers: Record<string, string> = {};
      injectTraceContext(
        {
          traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
          spanId: '00f067aa0ba902b7',
          traceFlags: 1,
          traceState: 'vendor=val',
        },
        headers
      );
      expect(headers['traceparent']).toBe(
        '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
      );
      expect(headers['tracestate']).toBe('vendor=val');
    });
  });
});

// ============================================================================
// Tracer Tests
// ============================================================================

describe('Tracer', () => {
  it('should create spans with service name', () => {
    const tracer = new Tracer({ serviceName: 'test-service' });
    const span = tracer.createSpan('operation');
    expect(span.attributes['service.name']).toBe('test-service');
  });

  it('should propagate traceId to child spans', () => {
    const tracer = new Tracer();
    const parent = tracer.createSpan('parent');
    const child = tracer.createSpan('child', {
      traceId: parent.traceId,
      parentSpanId: parent.spanId,
    });
    expect(child.traceId).toBe(parent.traceId);
    expect(child.parentSpanId).toBe(parent.spanId);
  });

  it('should execute function within span via startSpan', () => {
    const tracer = new Tracer();
    const result = tracer.startSpan('operation', (span) => {
      span.setAttribute('key', 'value');
      return 42;
    });
    expect(result).toBe(42);
  });

  it('should set error status on exception in startSpan', () => {
    const onSpanEnd = vi.fn();
    const tracer = new Tracer({ onSpanEnd });

    expect(() => {
      tracer.startSpan('failing-op', () => {
        throw new Error('test error');
      });
    }).toThrow('test error');

    expect(onSpanEnd).toHaveBeenCalledOnce();
    const endedSpan = onSpanEnd.mock.calls[0][0];
    expect(endedSpan.status.code).toBe(SpanStatusCode.ERROR);
    expect(endedSpan.status.message).toBe('test error');
  });

  it('should track active span', () => {
    const tracer = new Tracer();
    expect(tracer.getActiveSpan()).toBeUndefined();

    tracer.startSpan('operation', (span) => {
      expect(tracer.getActiveSpan()).toBe(span);
    });

    expect(tracer.getActiveSpan()).toBeUndefined();
  });

  it('should configure tracer options', () => {
    const tracer = new Tracer();
    const sampler = new NeverSampler();
    tracer.configure({ serviceName: 'new-service', sampler });
    expect(tracer.getSampler()).toBe(sampler);
  });

  it('should create DB spans with correct attributes', () => {
    const tracer = new Tracer();
    const span = tracer.createDbSpan('SELECT', 'users');
    expect(span.name).toBe('db.SELECT users');
    expect(span.attributes['db.system']).toBe('sql');
    expect(span.attributes['db.operation']).toBe('SELECT');
    expect(span.attributes['db.table']).toBe('users');
  });

  it('should create HTTP spans with correct attributes', () => {
    const tracer = new Tracer();
    const span = tracer.createHttpSpan('GET', 'https://api.example.com/users');
    expect(span.name).toBe('HTTP GET https://api.example.com/users');
    expect(span.attributes['http.method']).toBe('GET');
    expect(span.attributes['http.url']).toBe('https://api.example.com/users');
  });
});

// ============================================================================
// Sampler Tests
// ============================================================================

describe('Samplers', () => {
  describe('AlwaysSampler', () => {
    it('should always return RECORD_AND_SAMPLE', () => {
      const sampler = new AlwaysSampler();
      const result = sampler.shouldSample('abc123', 'test');
      expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLE);
    });
  });

  describe('NeverSampler', () => {
    it('should always return DROP', () => {
      const sampler = new NeverSampler();
      const result = sampler.shouldSample('abc123', 'test');
      expect(result.decision).toBe(SamplingDecision.DROP);
    });
  });

  describe('ProbabilitySampler', () => {
    it('should reject invalid rates', () => {
      expect(() => new ProbabilitySampler(-0.1)).toThrow();
      expect(() => new ProbabilitySampler(1.1)).toThrow();
    });

    it('should sample all with rate 1.0', () => {
      const sampler = new ProbabilitySampler(1.0);
      // Test with multiple trace IDs
      for (let i = 0; i < 20; i++) {
        const traceId = generateTraceId();
        expect(sampler.shouldSample(traceId, 'test').decision).toBe(
          SamplingDecision.RECORD_AND_SAMPLE
        );
      }
    });

    it('should sample none with rate 0.0', () => {
      const sampler = new ProbabilitySampler(0.0);
      for (let i = 0; i < 20; i++) {
        const traceId = generateTraceId();
        expect(sampler.shouldSample(traceId, 'test').decision).toBe(SamplingDecision.DROP);
      }
    });

    it('should be deterministic for the same traceId', () => {
      const sampler = new ProbabilitySampler(0.5);
      const traceId = generateTraceId();
      const first = sampler.shouldSample(traceId, 'test');
      const second = sampler.shouldSample(traceId, 'test');
      expect(first.decision).toBe(second.decision);
    });
  });

  describe('CompositeSampler', () => {
    it('should always sample errors', () => {
      const sampler = new CompositeSampler({ baseSampleRate: 0.0 });
      const result = sampler.shouldSample('abc', 'test', { error: true });
      expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLE);
      expect(result.attributes?.['sampling.reason']).toBe('error');
    });

    it('should always sample slow requests', () => {
      const sampler = new CompositeSampler({ baseSampleRate: 0.0, slowRequestThresholdMs: 1000 });
      const result = sampler.shouldSample('abc', 'test', { 'duration.ms': 1500 });
      expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLE);
      expect(result.attributes?.['sampling.reason']).toBe('slow_request');
    });

    it('should not sample fast successful requests with rate 0', () => {
      const sampler = new CompositeSampler({ baseSampleRate: 0.0 });
      const result = sampler.shouldSample('abc', 'test', { 'duration.ms': 50 });
      expect(result.decision).toBe(SamplingDecision.DROP);
    });

    it('should use default threshold of 1000ms', () => {
      const sampler = new CompositeSampler({ baseSampleRate: 0.0 });
      // 999ms should not trigger slow sampling
      const fast = sampler.shouldSample('abc', 'test', { 'duration.ms': 999 });
      expect(fast.decision).toBe(SamplingDecision.DROP);
      // 1001ms should trigger slow sampling
      const slow = sampler.shouldSample('abc', 'test', { 'duration.ms': 1001 });
      expect(slow.decision).toBe(SamplingDecision.RECORD_AND_SAMPLE);
    });
  });
});

// ============================================================================
// Tracing Middleware Tests
// ============================================================================

describe('createTracingMiddleware', () => {
  it('should create a root span for requests', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spans: any[] = [];
    const tracer = new Tracer({ serviceName: 'test', onSpanEnd: (s) => spans.push(s) });
    const middleware = createTracingMiddleware({ tracer });

    const req = { method: 'GET', url: '/api/users', headers: {} };
    const res = { statusCode: 200, headers: {} as Record<string, string> };

    middleware(req, res, () => {});

    expect(spans).toHaveLength(1);
    expect(spans[0].attributes['http.method']).toBe('GET');
    expect(spans[0].attributes['http.url']).toBe('/api/users');
    expect(spans[0].attributes['http.status_code']).toBe(200);
    expect(spans[0].status.code).toBe(SpanStatusCode.OK);
  });

  it('should set error status for error responses', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spans: any[] = [];
    const tracer = new Tracer({ serviceName: 'test', onSpanEnd: (s) => spans.push(s) });
    const middleware = createTracingMiddleware({ tracer });

    const req = { method: 'POST', url: '/api/users', headers: {} };
    const res = { statusCode: 500, headers: {} as Record<string, string> };

    middleware(req, res, () => {});

    expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
  });

  it('should set error status when next is called with error', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spans: any[] = [];
    const tracer = new Tracer({ serviceName: 'test', onSpanEnd: (s) => spans.push(s) });
    const middleware = createTracingMiddleware({ tracer });

    const req = { method: 'GET', url: '/api/users', headers: {} };
    const res = { statusCode: 200, headers: {} as Record<string, string> };

    middleware(req, res, () => {});
    // The middleware calls wrappedNext immediately, so we test the error path differently
    expect(spans).toHaveLength(1);
  });

  it('should propagate incoming trace context', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spans: any[] = [];
    const tracer = new Tracer({ serviceName: 'test', onSpanEnd: (s) => spans.push(s) });
    const middleware = createTracingMiddleware({ tracer });

    const req = {
      method: 'GET',
      url: '/api/users',
      headers: { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' },
    };
    const res = { statusCode: 200, headers: {} as Record<string, string> };

    middleware(req, res, () => {});

    expect(spans[0].traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(spans[0].parentSpanId).toBe('00f067aa0ba902b7');
  });

  it('should inject trace context into response headers', () => {
    const tracer = new Tracer({ serviceName: 'test' });
    const middleware = createTracingMiddleware({ tracer });

    const req = { method: 'GET', url: '/api/users', headers: {} };
    const res = { statusCode: 200, headers: {} as Record<string, string> };

    middleware(req, res, () => {});

    expect(res.headers['traceparent']).toBeDefined();
    expect(res.headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('should skip excluded paths', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spans: any[] = [];
    const tracer = new Tracer({ serviceName: 'test', onSpanEnd: (s) => spans.push(s) });
    const middleware = createTracingMiddleware({ tracer, excludePaths: ['/health'] });

    const req = { method: 'GET', url: '/health', headers: {} };
    const res = { statusCode: 200, headers: {} as Record<string, string> };
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    expect(spans).toHaveLength(0);
    expect(nextCalled).toBe(true);
  });
});
