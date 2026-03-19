import { describe, it, expect, beforeEach } from 'vitest';
import { WebhookRegistry } from '../webhook-registry';
import { MemoryWebhookStore } from '../stores/memory-webhook-store';

describe('WebhookRegistry', () => {
  let store: MemoryWebhookStore;
  let registry: WebhookRegistry;

  beforeEach(() => {
    store = new MemoryWebhookStore();
    registry = new WebhookRegistry(store);
  });

  it('registers a webhook and returns it with an id', async () => {
    const wh = await registry.register({
      url: 'https://example.com/hook',
      events: ['order.created'],
    });
    expect(wh.id).toBeTruthy();
    expect(wh.url).toBe('https://example.com/hook');
    expect(wh.events).toEqual(['order.created']);
    expect(wh.active).toBe(true);
    expect(wh.secret).toBeTruthy();
    expect(wh.createdAt).toBeGreaterThan(0);
  });

  it('uses a provided secret', async () => {
    const wh = await registry.register({
      url: 'https://example.com/hook',
      events: ['a'],
      secret: 'my-secret',
    });
    expect(wh.secret).toBe('my-secret');
  });

  it('retrieves a webhook by id', async () => {
    const wh = await registry.register({ url: 'https://example.com/hook', events: ['a'] });
    const found = await registry.get(wh.id);
    expect(found).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(found!.id).toBe(wh.id);
  });

  it('returns undefined for unknown id', async () => {
    expect(await registry.get('nonexistent')).toBeUndefined();
  });

  it('unregisters a webhook', async () => {
    const wh = await registry.register({ url: 'https://example.com/hook', events: ['a'] });
    const deleted = await registry.unregister(wh.id);
    expect(deleted).toBe(true);
    expect(await registry.get(wh.id)).toBeUndefined();
  });

  it('returns false when unregistering unknown id', async () => {
    expect(await registry.unregister('nonexistent')).toBe(false);
  });

  it('gets webhooks by event', async () => {
    await registry.register({ url: 'https://a.com', events: ['order.created', 'order.updated'] });
    await registry.register({ url: 'https://b.com', events: ['order.created'] });
    await registry.register({ url: 'https://c.com', events: ['user.created'] });

    const hooks = await registry.getByEvent('order.created');
    expect(hooks).toHaveLength(2);
  });

  it('only returns active webhooks for getByEvent', async () => {
    const wh = await registry.register({ url: 'https://a.com', events: ['order.created'] });
    await registry.update(wh.id, { active: false });

    const hooks = await registry.getByEvent('order.created');
    expect(hooks).toHaveLength(0);
  });

  it('lists all webhooks', async () => {
    await registry.register({ url: 'https://a.com', events: ['a'] });
    await registry.register({ url: 'https://b.com', events: ['b'] });

    const all = await registry.getAll();
    expect(all).toHaveLength(2);
  });

  it('updates a webhook', async () => {
    const wh = await registry.register({ url: 'https://a.com', events: ['a'] });
    const updated = await registry.update(wh.id, { url: 'https://b.com', events: ['b', 'c'] });

    expect(updated).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(updated!.url).toBe('https://b.com');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(updated!.events).toEqual(['b', 'c']);
  });

  it('returns undefined when updating unknown id', async () => {
    expect(await registry.update('nonexistent', { url: 'https://x.com' })).toBeUndefined();
  });
});
