# @web-loom/api-tracing

Distributed tracing for [Web Loom API](https://github.com/bretuobay/web-loom-api). W3C Trace Context propagation, configurable sampling strategies, and a Hono middleware for automatic span creation. Designed to integrate with OpenTelemetry-compatible backends (Jaeger, Zipkin, Honeycomb, Datadog).

## Installation

```bash
npm install @web-loom/api-tracing hono
```

## Usage

### Auto-Configuration via `api-core`

```typescript
defineConfig({
  observability: {
    tracing: { enabled: true, sampleRate: 0.1 },
  },
});
```

### Standalone Middleware

```typescript
import { createTracingMiddleware, Tracer } from '@web-loom/api-tracing';
import { Hono } from 'hono';

const tracer = new Tracer({ serviceName: 'my-api', sampleRate: 1.0 });
const app = new Hono();

// Automatically creates a root span for every request
app.use('/*', createTracingMiddleware(tracer));
```

## Manual Instrumentation

```typescript
import { Tracer } from '@web-loom/api-tracing';

const tracer = new Tracer({ serviceName: 'my-api' });

async function createOrder(items: Item[]) {
  const span = tracer.startSpan('createOrder');

  try {
    span.setAttribute('order.itemCount', items.length);

    const dbSpan = tracer.startSpan('db.insert', { parent: span });
    const [order] = await db.insert(ordersTable).values({ items }).returning();
    dbSpan.end();

    span.setAttribute('order.id', order.id);
    return order;
  } catch (err) {
    span.setStatus('error', err.message);
    throw err;
  } finally {
    span.end();
  }
}
```

## W3C Trace Context

Trace context is propagated via the standard `traceparent` and `tracestate` headers:

```typescript
import { parseTraceContext, injectTraceContext } from '@web-loom/api-tracing';

// Extract from an incoming request
const ctx = parseTraceContext(request.headers.get('traceparent') ?? '');

// Inject into an outgoing fetch call
const headers = new Headers();
injectTraceContext(headers, span);
await fetch('https://other-service.example.com/api', { headers });
```

## Sampling Strategies

```typescript
import { Tracer, AlwaysSampler, RateSampler, ParentBasedSampler } from '@web-loom/api-tracing';

// Sample everything (development)
const tracer = new Tracer({ sampler: new AlwaysSampler() });

// Sample 10% of root traces (production)
const tracer = new Tracer({ sampler: new RateSampler(0.1) });

// Respect the parent span's sampling decision
const tracer = new Tracer({ sampler: new ParentBasedSampler(new RateSampler(0.1)) });
```

## Span API

```typescript
const span = tracer.startSpan(name, options?);

span.setAttribute(key, value)    // Add key-value metadata
span.addEvent(name, attributes?) // Record a timestamped event
span.setStatus('ok' | 'error', message?)
span.end()                       // Finalize the span
```

## `Tracer` Options

| Option        | Type           | Default                   | Description                         |
| ------------- | -------------- | ------------------------- | ----------------------------------- |
| `serviceName` | `string`       | `'web-loom-api'`          | Service name in trace metadata      |
| `sampleRate`  | `number`       | `1.0`                     | Fraction of requests to trace (0–1) |
| `sampler`     | `Sampler`      | `RateSampler(sampleRate)` | Custom sampler instance             |
| `exporter`    | `SpanExporter` | console (dev)             | Where to send completed spans       |

## License

MIT
