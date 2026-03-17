/**
 * Webhook Delivery
 *
 * Delivers webhook events to registered URLs with HMAC-SHA256 signatures,
 * retry logic with exponential backoff, and delivery logging.
 */

import { randomUUID } from 'node:crypto';
import type {
  DeliveryLogEntry,
  DeliveryLogStore,
  DeliveryOptions,
  DeliveryResult,
  HttpTransport,
  Webhook,
} from './types';
import { signPayload, SIGNATURE_HEADER } from './signature';
import { MemoryDeliveryLogStore } from './stores/memory-delivery-log-store';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30_000;
const DEFAULT_TIMEOUT = 10_000;

/**
 * Calculate exponential backoff delay.
 */
export function calculateBackoffDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const delay = baseDelay * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Default HTTP transport using fetch.
 */
export const defaultTransport: HttpTransport = {
  async post(url: string, body: string, headers: Record<string, string>, timeout: number): Promise<number> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body,
        signal: controller.signal,
      });
      return response.status;
    } finally {
      clearTimeout(timer);
    }
  },
};

export class WebhookDelivery {
  private logStore: DeliveryLogStore;
  private transport: HttpTransport;
  private options: Required<DeliveryOptions>;

  constructor(opts?: {
    logStore?: DeliveryLogStore;
    transport?: HttpTransport;
    deliveryOptions?: DeliveryOptions;
  }) {
    this.logStore = opts?.logStore ?? new MemoryDeliveryLogStore();
    this.transport = opts?.transport ?? defaultTransport;
    this.options = {
      maxAttempts: opts?.deliveryOptions?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      baseDelay: opts?.deliveryOptions?.baseDelay ?? DEFAULT_BASE_DELAY,
      maxDelay: opts?.deliveryOptions?.maxDelay ?? DEFAULT_MAX_DELAY,
      timeout: opts?.deliveryOptions?.timeout ?? DEFAULT_TIMEOUT,
    };
  }

  /**
   * Deliver an event payload to a single webhook with retries.
   */
  async deliver(webhook: Webhook, event: string, payload: unknown): Promise<DeliveryResult> {
    const body = JSON.stringify({ event, data: payload, timestamp: Date.now() });
    const signature = signPayload(body, webhook.secret);

    let lastStatusCode: number | undefined;
    let lastError: string | undefined;
    let attempts = 0;

    for (let attempt = 1; attempt <= (this.options.maxAttempts ?? 3); attempt++) {
      attempts = attempt;

      if (attempt > 1) {
        const delay = calculateBackoffDelay(attempt - 1, this.options.baseDelay ?? 1000, this.options.maxDelay ?? 30000);
        await this.sleep(delay);
      }

      try {
        const statusCode = await this.transport.post(
          webhook.url,
          body,
          { [SIGNATURE_HEADER]: signature },
          this.options.timeout ?? 10000,
        );
        lastStatusCode = statusCode;

        if (statusCode >= 200 && statusCode < 300) {
          const result: DeliveryResult = {
            webhookId: webhook.id,
            status: 'success',
            statusCode,
            attempts,
            lastAttemptAt: Date.now(),
          };
          await this.log(webhook.id, event, result);
          return result;
        }

        lastError = `HTTP ${statusCode}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    const result: DeliveryResult = {
      webhookId: webhook.id,
      status: 'failed',
      statusCode: lastStatusCode,
      attempts,
      lastAttemptAt: Date.now(),
      error: lastError,
    };
    await this.log(webhook.id, event, result);
    return result;
  }

  /**
   * Get delivery logs for a webhook.
   */
  async getLogs(webhookId: string): Promise<DeliveryLogEntry[]> {
    return this.logStore.getByWebhookId(webhookId);
  }

  /**
   * Get all delivery logs.
   */
  async getAllLogs(): Promise<DeliveryLogEntry[]> {
    return this.logStore.getAll();
  }

  private async log(webhookId: string, event: string, result: DeliveryResult): Promise<void> {
    const entry: DeliveryLogEntry = {
      id: randomUUID(),
      webhookId,
      event,
      result: { ...result },
      timestamp: Date.now(),
    };
    await this.logStore.append(entry);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
