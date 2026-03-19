/**
 * Webhook Registry
 *
 * Manages webhook registration, unregistration, and lookup.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import type { Webhook, WebhookCreateOptions, WebhookStore } from './types';
import { MemoryWebhookStore } from './stores/memory-webhook-store';

export class WebhookRegistry {
  private store: WebhookStore;

  constructor(store?: WebhookStore) {
    this.store = store ?? new MemoryWebhookStore();
  }

  /**
   * Register a new webhook.
   */
  async register(options: WebhookCreateOptions): Promise<Webhook> {
    const webhook: Webhook = {
      id: randomUUID(),
      url: options.url,
      events: [...options.events],
      secret: options.secret ?? randomBytes(32).toString('hex'),
      active: true,
      createdAt: Date.now(),
    };
    await this.store.save(webhook);
    return webhook;
  }

  /**
   * Unregister (delete) a webhook by ID.
   */
  async unregister(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  /**
   * Get a webhook by ID.
   */
  async get(id: string): Promise<Webhook | undefined> {
    return this.store.get(id);
  }

  /**
   * Get all active webhooks subscribed to a given event.
   */
  async getByEvent(event: string): Promise<Webhook[]> {
    return this.store.getByEvent(event);
  }

  /**
   * Get all registered webhooks.
   */
  async getAll(): Promise<Webhook[]> {
    return this.store.getAll();
  }

  /**
   * Update a webhook's properties.
   */
  async update(
    id: string,
    updates: Partial<Pick<Webhook, 'url' | 'events' | 'active'>>
  ): Promise<Webhook | undefined> {
    const existing = await this.store.get(id);
    if (!existing) return undefined;

    const updated: Webhook = {
      ...existing,
      ...updates,
      events: updates.events ? [...updates.events] : existing.events,
    };
    await this.store.save(updated);
    return updated;
  }
}
