import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookDelivery, calculateBackoffDelay } from '../webhook-delivery';
import { MemoryDeliveryLogStore } from '../stores/memory-delivery-log-store';
import type { HttpTransport, Webhook } from '../types';
import { verifySignature, SIGNATURE_HEADER } from '../signature';

function makeWebhook(overrides?: Partial<Webhook>): Webhook {
  return {
    id: 'wh-1',
    url: 'https://example.com/hook',
    events: ['order.created'],
    secret: 'test-secret',
    active: true,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('calculateBackoffDelay', () => {
  it('returns baseDelay for first attempt', () => {
    expect(calculateBackoffDelay(1, 1000, 30_000)).toBe(1000);
  });

  it('doubles for second attempt', () => {
    expect(calculateBackoffDelay(2, 1000, 30_000)).toBe(2000);
  });

  it('caps at maxDelay', () => {
    expect(calculateBackoffDelay(100, 1000, 30_000)).toBe(30_000);
  });
});

describe('WebhookDelivery', () => {
  let logStore: MemoryDeliveryLogStore;
  let transport: HttpTransport;
  let delivery: WebhookDelivery;

  beforeEach(() => {
    logStore = new MemoryDeliveryLogStore();
    transport = {
      post: vi.fn().mockResolvedValue(200),
    };
    delivery = new WebhookDelivery({
      logStore,
      transport,
      deliveryOptions: { maxAttempts: 3, baseDelay: 10, maxDelay: 100, timeout: 5000 },
    });
  });

  it('delivers successfully on 2xx response', async () => {
    const wh = makeWebhook();
    const result = await delivery.deliver(wh, 'order.created', { orderId: '123' });

    expect(result.status).toBe('success');
    expect(result.statusCode).toBe(200);
    expect(result.attempts).toBe(1);
    expect(result.webhookId).toBe('wh-1');
    expect(transport.post).toHaveBeenCalledOnce();
  });

  it('sends HMAC-SHA256 signature in header', async () => {
    const wh = makeWebhook();
    await delivery.deliver(wh, 'order.created', { orderId: '123' });

    const [url, body, headers] = (transport.post as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('https://example.com/hook');
    expect(headers[SIGNATURE_HEADER]).toBeTruthy();
    // Verify the signature is valid
    expect(verifySignature(body, 'test-secret', headers[SIGNATURE_HEADER])).toBe(true);
  });

  it('retries on non-2xx response', async () => {
    (transport.post as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(500)
      .mockResolvedValueOnce(500)
      .mockResolvedValueOnce(200);

    const wh = makeWebhook();
    const result = await delivery.deliver(wh, 'order.created', {});

    expect(result.status).toBe('success');
    expect(result.attempts).toBe(3);
  });

  it('fails after max attempts', async () => {
    (transport.post as ReturnType<typeof vi.fn>).mockResolvedValue(500);

    const wh = makeWebhook();
    const result = await delivery.deliver(wh, 'order.created', {});

    expect(result.status).toBe('failed');
    expect(result.attempts).toBe(3);
    expect(result.error).toBe('HTTP 500');
  });

  it('handles transport errors', async () => {
    (transport.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    const wh = makeWebhook();
    const result = await delivery.deliver(wh, 'order.created', {});

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Network error');
  });

  it('logs successful deliveries', async () => {
    const wh = makeWebhook();
    await delivery.deliver(wh, 'order.created', {});

    const logs = await delivery.getLogs('wh-1');
    expect(logs).toHaveLength(1);
    expect(logs[0]!.event).toBe('order.created');
    expect(logs[0]!.result.status).toBe('success');
  });

  it('logs failed deliveries', async () => {
    (transport.post as ReturnType<typeof vi.fn>).mockResolvedValue(500);

    const wh = makeWebhook();
    await delivery.deliver(wh, 'order.created', {});

    const logs = await delivery.getLogs('wh-1');
    expect(logs).toHaveLength(1);
    expect(logs[0]!.result.status).toBe('failed');
  });
});
