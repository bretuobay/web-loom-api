import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookManager } from '../webhook-manager';
import { MemoryWebhookStore } from '../stores/memory-webhook-store';
import { MemoryDeliveryLogStore } from '../stores/memory-delivery-log-store';
import type { HttpTransport } from '../types';

describe('WebhookManager', () => {
  let webhookStore: MemoryWebhookStore;
  let logStore: MemoryDeliveryLogStore;
  let transport: HttpTransport;
  let manager: WebhookManager;

  beforeEach(() => {
    webhookStore = new MemoryWebhookStore();
    logStore = new MemoryDeliveryLogStore();
    transport = { post: vi.fn().mockResolvedValue(200) };
    manager = new WebhookManager({
      webhookStore,
      logStore,
      transport,
      deliveryOptions: { maxAttempts: 1, baseDelay: 10, maxDelay: 50, timeout: 5000 },
    });
  });

  // CRUD
  it('creates a webhook', async () => {
    const wh = await manager.create({ url: 'https://a.com/hook', events: ['order.created'] });
    expect(wh.id).toBeTruthy();
    expect(wh.url).toBe('https://a.com/hook');
  });

  it('gets a webhook by id', async () => {
    const wh = await manager.create({ url: 'https://a.com/hook', events: ['a'] });
    const found = await manager.get(wh.id);
    expect(found).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(found!.id).toBe(wh.id);
  });

  it('lists all webhooks', async () => {
    await manager.create({ url: 'https://a.com', events: ['a'] });
    await manager.create({ url: 'https://b.com', events: ['b'] });
    const all = await manager.list();
    expect(all).toHaveLength(2);
  });

  it('updates a webhook', async () => {
    const wh = await manager.create({ url: 'https://a.com', events: ['a'] });
    const updated = await manager.update(wh.id, { active: false });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(updated!.active).toBe(false);
  });

  it('deletes a webhook', async () => {
    const wh = await manager.create({ url: 'https://a.com', events: ['a'] });
    expect(await manager.delete(wh.id)).toBe(true);
    expect(await manager.get(wh.id)).toBeUndefined();
  });

  // Dispatch
  it('dispatches events to matching webhooks', async () => {
    await manager.create({ url: 'https://a.com', events: ['order.created'] });
    await manager.create({ url: 'https://b.com', events: ['order.created'] });
    await manager.create({ url: 'https://c.com', events: ['user.created'] });

    const results = await manager.dispatch('order.created', { orderId: '1' });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'success')).toBe(true);
  });

  it('returns empty array when no webhooks match', async () => {
    const results = await manager.dispatch('unknown.event', {});
    expect(results).toEqual([]);
  });

  // Delivery Logs
  it('retrieves delivery logs for a webhook', async () => {
    const wh = await manager.create({ url: 'https://a.com', events: ['order.created'] });
    await manager.dispatch('order.created', {});

    const logs = await manager.getDeliveryLogs(wh.id);
    expect(logs).toHaveLength(1);
  });

  it('retrieves all delivery logs', async () => {
    await manager.create({ url: 'https://a.com', events: ['a'] });
    await manager.create({ url: 'https://b.com', events: ['a'] });
    await manager.dispatch('a', {});

    const logs = await manager.getAllDeliveryLogs();
    expect(logs).toHaveLength(2);
  });

  // Test Endpoint
  it('sends a test event to a specific webhook', async () => {
    const wh = await manager.create({ url: 'https://a.com', events: ['order.created'] });
    const result = await manager.test(wh.id);

    expect(result).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result!.status).toBe('success');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result!.webhookId).toBe(wh.id);
  });

  it('returns undefined when testing unknown webhook', async () => {
    const result = await manager.test('nonexistent');
    expect(result).toBeUndefined();
  });
});
