/**
 * Webhook Types
 *
 * Type definitions for webhook registration, delivery,
 * event logging, and signature verification.
 */

// -----------------------------------------------------------------------
// Webhook Definition
// -----------------------------------------------------------------------

export interface Webhook {
  /** Unique webhook identifier */
  id: string;
  /** Target URL to deliver events to */
  url: string;
  /** List of event types this webhook subscribes to */
  events: string[];
  /** Secret used for HMAC-SHA256 signature generation */
  secret: string;
  /** Whether the webhook is active */
  active: boolean;
  /** Timestamp when the webhook was created */
  createdAt: number;
}

// -----------------------------------------------------------------------
// Webhook Registration Options
// -----------------------------------------------------------------------

export interface WebhookCreateOptions {
  /** Target URL */
  url: string;
  /** Event types to subscribe to */
  events: string[];
  /** Secret for signature verification (auto-generated if omitted) */
  secret?: string | undefined;
}

// -----------------------------------------------------------------------
// Delivery Result
// -----------------------------------------------------------------------

export type DeliveryStatus = 'success' | 'failed' | 'pending';

export interface DeliveryResult {
  /** ID of the webhook that was delivered to */
  webhookId: string;
  /** Delivery status */
  status: DeliveryStatus;
  /** HTTP status code from the target (undefined if request failed) */
  statusCode?: number | undefined;
  /** Number of delivery attempts made */
  attempts: number;
  /** Timestamp of the last delivery attempt */
  lastAttemptAt: number;
  /** Error message if delivery failed */
  error?: string | undefined;
}

// -----------------------------------------------------------------------
// Delivery Log Entry
// -----------------------------------------------------------------------

export interface DeliveryLogEntry {
  /** Unique log entry ID */
  id: string;
  /** Webhook ID */
  webhookId: string;
  /** Event type that triggered the delivery */
  event: string;
  /** Delivery result */
  result: DeliveryResult;
  /** Timestamp */
  timestamp: number;
}

// -----------------------------------------------------------------------
// Delivery Options
// -----------------------------------------------------------------------

export interface DeliveryOptions {
  /** Maximum number of retry attempts. Default: 3 */
  maxAttempts?: number | undefined;
  /** Base delay in ms for exponential backoff. Default: 1000 */
  baseDelay?: number | undefined;
  /** Maximum delay in ms. Default: 30_000 */
  maxDelay?: number | undefined;
  /** Request timeout in ms. Default: 10_000 */
  timeout?: number | undefined;
}

// -----------------------------------------------------------------------
// HTTP Transport (for testability)
// -----------------------------------------------------------------------

export interface HttpTransport {
  /** Send a POST request and return the status code */
  post(
    url: string,
    body: string,
    headers: Record<string, string>,
    timeout: number
  ): Promise<number>;
}

// -----------------------------------------------------------------------
// Webhook Store
// -----------------------------------------------------------------------

export interface WebhookStore {
  /** Save a webhook (insert or update) */
  save(webhook: Webhook): Promise<void>;
  /** Get a webhook by ID */
  get(id: string): Promise<Webhook | undefined>;
  /** Get all webhooks subscribed to a given event */
  getByEvent(event: string): Promise<Webhook[]>;
  /** Get all webhooks */
  getAll(): Promise<Webhook[]>;
  /** Delete a webhook by ID */
  delete(id: string): Promise<boolean>;
  /** Clear all webhooks */
  clear(): Promise<void>;
}

// -----------------------------------------------------------------------
// Delivery Log Store
// -----------------------------------------------------------------------

export interface DeliveryLogStore {
  /** Append a delivery log entry */
  append(entry: DeliveryLogEntry): Promise<void>;
  /** Get delivery logs for a webhook */
  getByWebhookId(webhookId: string): Promise<DeliveryLogEntry[]>;
  /** Get all delivery logs */
  getAll(): Promise<DeliveryLogEntry[]>;
  /** Clear all logs */
  clear(): Promise<void>;
}
