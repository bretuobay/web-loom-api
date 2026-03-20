# @web-loom/api-webhooks

Webhook system for [Web Loom API](https://github.com/bretuobay/web-loom-api). HMAC-SHA256 signed delivery, exponential backoff retries, delivery logging, and pluggable storage backends.

## Installation

```bash
npm install @web-loom/api-webhooks
```

## Quick Start

```typescript
import { WebhookManager, MemoryWebhookStore, MemoryDeliveryLogStore } from '@web-loom/api-webhooks';

// Create manager with in-memory stores
const webhookManager = new WebhookManager({
  webhookStore: new MemoryWebhookStore(),
  logStore: new MemoryDeliveryLogStore(),
  deliveryOptions: { maxAttempts: 5, timeout: 10_000 },
});

// Register a subscriber
await webhookManager.create({
  url: 'https://partner.example.com/hooks',
  events: ['order.created', 'order.shipped'],
  secret: process.env.WEBHOOK_SECRET, // auto-generated if omitted
});

// Dispatch an event from a route handler
await webhookManager.dispatch('order.created', {
  orderId: 'ord_123',
  total: 99.99,
});
```

## Registering Subscribers

```typescript
const webhook = await webhookManager.create({
  url: 'https://partner.example.com/hooks',
  events: ['post.created', 'post.deleted'],
  secret: 'optional-signing-secret',
});

// webhook.id — unique ID
// webhook.secret — HMAC signing secret (keep private)
```

## Dispatching Events

```typescript
// Returns an array of DeliveryResult (one per active subscriber)
const results = await webhookManager.dispatch('post.created', {
  postId: 'abc',
  title: 'Hello world',
  authorId: '123',
});

results.forEach((r) => {
  console.log(r.webhookId, r.status, r.statusCode, r.attempts);
});
```

## Signature Verification (Subscriber Side)

Subscribers should verify the `X-Webhook-Signature` header on every delivery:

```typescript
import { verifySignature, SIGNATURE_HEADER } from '@web-loom/api-webhooks';

// In your webhook receiver endpoint:
const signature = request.headers.get(SIGNATURE_HEADER) ?? '';
const body = await request.text();
const isValid = await verifySignature(body, signature, process.env.WEBHOOK_SECRET!);

if (!isValid) return new Response('Unauthorized', { status: 401 });
```

## Delivery Logs

```typescript
// Get all delivery logs for a specific webhook
const logs = await webhookManager.getDeliveryLogs(webhookId);

// Get all delivery logs
const allLogs = await webhookManager.getAllDeliveryLogs();

// Send a test delivery
const result = await webhookManager.test(webhookId);
```

## Managing Webhooks

```typescript
// List all registered webhooks
const webhooks = await webhookManager.list();

// Update a webhook
await webhookManager.update(webhookId, {
  events: ['post.created'],
  active: false,
});

// Delete a webhook
await webhookManager.delete(webhookId);
```

## `WebhookManagerOptions`

| Option            | Type               | Description                                         |
| ----------------- | ------------------ | --------------------------------------------------- |
| `webhookStore`    | `WebhookStore`     | Webhook persistence (default: `MemoryWebhookStore`) |
| `logStore`        | `DeliveryLogStore` | Log persistence (default: `MemoryDeliveryLogStore`) |
| `transport`       | `HttpTransport`    | Custom HTTP transport (default: `fetch`)            |
| `deliveryOptions` | `DeliveryOptions`  | Retry/timeout configuration                         |

## `DeliveryOptions`

| Option        | Type     | Default | Description                      |
| ------------- | -------- | ------- | -------------------------------- |
| `maxAttempts` | `number` | `3`     | Maximum delivery attempts        |
| `baseDelay`   | `number` | `1000`  | Initial backoff delay (ms)       |
| `maxDelay`    | `number` | `30000` | Maximum backoff delay (ms)       |
| `timeout`     | `number` | `10000` | Request timeout per attempt (ms) |

## License

MIT
