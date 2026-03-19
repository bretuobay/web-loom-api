/**
 * In-memory Delivery Log Store
 */

import type { DeliveryLogEntry, DeliveryLogStore } from '../types';

export class MemoryDeliveryLogStore implements DeliveryLogStore {
  private logs: DeliveryLogEntry[] = [];

  async append(entry: DeliveryLogEntry): Promise<void> {
    this.logs.push({ ...entry });
  }

  async getByWebhookId(webhookId: string): Promise<DeliveryLogEntry[]> {
    return this.logs.filter((e) => e.webhookId === webhookId).map((e) => ({ ...e }));
  }

  async getAll(): Promise<DeliveryLogEntry[]> {
    return this.logs.map((e) => ({ ...e }));
  }

  async clear(): Promise<void> {
    this.logs = [];
  }
}
