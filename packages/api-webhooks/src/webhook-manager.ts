/**
 * Webhook Manager
 *
 * High-level API that combines the registry and delivery system.
 * Provides CRUD operations, event dispatching, and a test endpoint.
 */

import type {
  DeliveryLogEntry,
  DeliveryResult,
  Webhook,
  WebhookCreateOptions,
  WebhookStore,
  DeliveryLogStore,
  DeliveryOptions,
  HttpTransport,
} from './types';
import { WebhookRegistry } from './webhook-registry';
import { WebhookDelivery } from './webhook-delivery';

export interface WebhookManagerOptions {
  /** Webhook store backend */
  webhookStore?: WebhookStore;
  /** Delivery log store backend */
  logStore?: DeliveryLogStore;
  /** HTTP transport for delivery */
  transport?: HttpTransport;
  /** Delivery retry options */
  deliveryOptions?: DeliveryOptions;
}

export class WebhookManager {
  readonly registry: WebhookRegistry;
  readonly delivery: WebhookDelivery;

  constructor(opts?: WebhookManagerOptions) {
    this.registry = new WebhookRegistry(opts?.webhookStore);
    this.delivery = new WebhookDelivery(
      opts
        ? {
            ...(opts.logStore !== undefined && { logStore: opts.logStore }),
            ...(opts.transport !== undefined && { transport: opts.transport }),
            ...(opts.deliveryOptions !== undefined && { deliveryOptions: opts.deliveryOptions }),
          }
        : undefined
    );
  }

  // -------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------

  /** Create a new webhook registration. */
  async create(options: WebhookCreateOptions): Promise<Webhook> {
    return this.registry.register(options);
  }

  /** Get a webhook by ID. */
  async get(id: string): Promise<Webhook | undefined> {
    return this.registry.get(id);
  }

  /** List all webhooks. */
  async list(): Promise<Webhook[]> {
    return this.registry.getAll();
  }

  /** Update a webhook. */
  async update(
    id: string,
    updates: Partial<Pick<Webhook, 'url' | 'events' | 'active'>>
  ): Promise<Webhook | undefined> {
    return this.registry.update(id, updates);
  }

  /** Delete a webhook. */
  async delete(id: string): Promise<boolean> {
    return this.registry.unregister(id);
  }

  // -------------------------------------------------------------------
  // Event Dispatching
  // -------------------------------------------------------------------

  /**
   * Dispatch an event to all active webhooks subscribed to it.
   * Returns delivery results for each webhook.
   */
  async dispatch(event: string, payload: unknown): Promise<DeliveryResult[]> {
    const webhooks = await this.registry.getByEvent(event);
    const results = await Promise.all(
      webhooks.map((wh) => this.delivery.deliver(wh, event, payload))
    );
    return results;
  }

  // -------------------------------------------------------------------
  // Delivery Logs
  // -------------------------------------------------------------------

  /** Get delivery logs for a specific webhook. */
  async getDeliveryLogs(webhookId: string): Promise<DeliveryLogEntry[]> {
    return this.delivery.getLogs(webhookId);
  }

  /** Get all delivery logs. */
  async getAllDeliveryLogs(): Promise<DeliveryLogEntry[]> {
    return this.delivery.getAllLogs();
  }

  // -------------------------------------------------------------------
  // Test Endpoint
  // -------------------------------------------------------------------

  /**
   * Send a test event to a specific webhook.
   * Useful for verifying webhook configuration.
   */
  async test(webhookId: string): Promise<DeliveryResult | undefined> {
    const webhook = await this.registry.get(webhookId);
    if (!webhook) return undefined;

    return this.delivery.deliver(webhook, 'webhook.test', {
      message: 'This is a test webhook delivery',
      webhookId: webhook.id,
    });
  }
}
