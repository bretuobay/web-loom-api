/**
 * In-memory Webhook Store
 */

import type { Webhook, WebhookStore } from '../types';

export class MemoryWebhookStore implements WebhookStore {
  private webhooks = new Map<string, Webhook>();

  async save(webhook: Webhook): Promise<void> {
    this.webhooks.set(webhook.id, { ...webhook });
  }

  async get(id: string): Promise<Webhook | undefined> {
    const wh = this.webhooks.get(id);
    return wh ? { ...wh } : undefined;
  }

  async getByEvent(event: string): Promise<Webhook[]> {
    const results: Webhook[] = [];
    for (const wh of this.webhooks.values()) {
      if (wh.active && wh.events.includes(event)) {
        results.push({ ...wh });
      }
    }
    return results;
  }

  async getAll(): Promise<Webhook[]> {
    return [...this.webhooks.values()].map((wh) => ({ ...wh }));
  }

  async delete(id: string): Promise<boolean> {
    return this.webhooks.delete(id);
  }

  async clear(): Promise<void> {
    this.webhooks.clear();
  }
}
