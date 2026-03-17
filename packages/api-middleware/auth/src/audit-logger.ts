/**
 * Audit Logger
 *
 * Structured logging of security-relevant events: authentication attempts,
 * authorization failures, data modifications, configuration changes, and
 * API key operations.
 *
 * @example
 * ```typescript
 * import { createAuditLogger } from '@web-loom/api-middleware-auth';
 *
 * const audit = createAuditLogger();
 * audit.logAuthAttempt({ userId: 'u1', ipAddress: '127.0.0.1', success: true });
 *
 * // Custom output handler
 * const audit = createAuditLogger({
 *   handler: (entry) => externalService.send(entry),
 * });
 * ```
 *
 * Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported audit event types */
export type AuditEventType =
  | 'AUTH_ATTEMPT'
  | 'AUTH_FAILURE'
  | 'ACCESS_DENIED'
  | 'DATA_MODIFICATION'
  | 'CONFIG_CHANGE'
  | 'API_KEY_OPERATION';

/** Base fields present on every audit log entry */
export interface AuditLogEntry {
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Event category */
  eventType: AuditEventType;
  /** User who triggered the event (may be unknown) */
  userId: string | null;
  /** Originating IP address */
  ipAddress: string | null;
  /** Affected resource (e.g. route path, model name) */
  resource: string;
  /** Action performed */
  action: string;
  /** Arbitrary extra details */
  details?: Record<string, unknown> | undefined;
}

/** Handler function that receives formatted audit entries */
export type AuditOutputHandler = (entry: AuditLogEntry) => void;

/** Options for creating an audit logger */
export interface AuditLoggerOptions {
  /** Custom output handler. Defaults to `console.log` JSON output. */
  handler?: AuditOutputHandler | undefined;
}

// ---------------------------------------------------------------------------
// Convenience parameter types
// ---------------------------------------------------------------------------

export interface AuthAttemptParams {
  userId?: string | null | undefined;
  ipAddress?: string | null | undefined;
  success: boolean;
  resource?: string | undefined;
  details?: Record<string, unknown> | undefined;
}

export interface AuthFailureParams {
  userId?: string | null | undefined;
  ipAddress?: string | null | undefined;
  resource?: string | undefined;
  reason?: string | undefined;
  details?: Record<string, unknown> | undefined;
}

export interface AccessDeniedParams {
  userId?: string | null | undefined;
  ipAddress?: string | null | undefined;
  resource: string;
  requiredRole?: string | undefined;
  details?: Record<string, unknown> | undefined;
}

export interface DataModificationParams {
  userId?: string | null | undefined;
  ipAddress?: string | null | undefined;
  resource: string;
  action: 'create' | 'update' | 'delete';
  details?: Record<string, unknown> | undefined;
}

export interface ApiKeyOperationParams {
  userId?: string | null | undefined;
  ipAddress?: string | null | undefined;
  action: 'create' | 'revoke' | 'rotate';
  keyId?: string | undefined;
  details?: Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// AuditLogger class
// ---------------------------------------------------------------------------

export class AuditLogger {
  private readonly handler: AuditOutputHandler;

  constructor(options: AuditLoggerOptions = {}) {
    this.handler =
      options.handler ??
      ((entry: AuditLogEntry) => {
        // Default: structured JSON to stdout (separate stream concept)
        console.log(JSON.stringify(entry));
      });
  }

  // -- helpers --------------------------------------------------------------

  private emit(entry: AuditLogEntry): void {
    this.handler(entry);
  }

  private now(): string {
    return new Date().toISOString();
  }

  // -- public API -----------------------------------------------------------

  logAuthAttempt(params: AuthAttemptParams): void {
    this.emit({
      timestamp: this.now(),
      eventType: 'AUTH_ATTEMPT',
      userId: params.userId ?? null,
      ipAddress: params.ipAddress ?? null,
      resource: params.resource ?? '/auth',
      action: params.success ? 'login_success' : 'login_failure',
      details: params.details,
    });
  }

  logAuthFailure(params: AuthFailureParams): void {
    this.emit({
      timestamp: this.now(),
      eventType: 'AUTH_FAILURE',
      userId: params.userId ?? null,
      ipAddress: params.ipAddress ?? null,
      resource: params.resource ?? '/auth',
      action: 'auth_failure',
      details: { reason: params.reason, ...params.details },
    });
  }

  logAccessDenied(params: AccessDeniedParams): void {
    this.emit({
      timestamp: this.now(),
      eventType: 'ACCESS_DENIED',
      userId: params.userId ?? null,
      ipAddress: params.ipAddress ?? null,
      resource: params.resource,
      action: 'access_denied',
      details: { requiredRole: params.requiredRole, ...params.details },
    });
  }

  logDataModification(params: DataModificationParams): void {
    this.emit({
      timestamp: this.now(),
      eventType: 'DATA_MODIFICATION',
      userId: params.userId ?? null,
      ipAddress: params.ipAddress ?? null,
      resource: params.resource,
      action: params.action,
      details: params.details,
    });
  }

  logConfigChange(params: {
    userId?: string | null | undefined;
    ipAddress?: string | null | undefined;
    resource: string;
    details?: Record<string, unknown> | undefined;
  }): void {
    this.emit({
      timestamp: this.now(),
      eventType: 'CONFIG_CHANGE',
      userId: params.userId ?? null,
      ipAddress: params.ipAddress ?? null,
      resource: params.resource,
      action: 'config_change',
      details: params.details,
    });
  }

  logApiKeyOperation(params: ApiKeyOperationParams): void {
    this.emit({
      timestamp: this.now(),
      eventType: 'API_KEY_OPERATION',
      userId: params.userId ?? null,
      ipAddress: params.ipAddress ?? null,
      resource: params.keyId ?? 'api-key',
      action: params.action,
      details: params.details,
    });
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an audit logger instance.
 *
 * @param options - Optional configuration (custom output handler, etc.)
 * @returns AuditLogger instance
 */
export function createAuditLogger(options?: AuditLoggerOptions): AuditLogger {
  return new AuditLogger(options);
}
