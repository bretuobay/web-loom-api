import { describe, it, expect, vi } from 'vitest';
import { createAuditLogger, AuditLogger } from '../audit-logger';
import type { AuditLogEntry } from '../audit-logger';

describe('AuditLogger', () => {
  it('creates an instance via factory', () => {
    const logger = createAuditLogger();
    expect(logger).toBeInstanceOf(AuditLogger);
  });

  it('logs auth attempts with success', () => {
    const entries: AuditLogEntry[] = [];
    const logger = createAuditLogger({ handler: (e) => entries.push(e) });

    logger.logAuthAttempt({ userId: 'u1', ipAddress: '10.0.0.1', success: true });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.eventType).toBe('AUTH_ATTEMPT');
    expect(entries[0]!.action).toBe('login_success');
    expect(entries[0]!.userId).toBe('u1');
    expect(entries[0]!.ipAddress).toBe('10.0.0.1');
    expect(entries[0]!.timestamp).toBeTruthy();
  });

  it('logs auth attempts with failure', () => {
    const entries: AuditLogEntry[] = [];
    const logger = createAuditLogger({ handler: (e) => entries.push(e) });

    logger.logAuthAttempt({ success: false });

    expect(entries[0]!.action).toBe('login_failure');
    expect(entries[0]!.userId).toBeNull();
  });

  it('logs auth failures with reason', () => {
    const entries: AuditLogEntry[] = [];
    const logger = createAuditLogger({ handler: (e) => entries.push(e) });

    logger.logAuthFailure({ reason: 'invalid_password', userId: 'u2' });

    expect(entries[0]!.eventType).toBe('AUTH_FAILURE');
    expect(entries[0]!.details).toEqual(
      expect.objectContaining({ reason: 'invalid_password' }),
    );
  });

  it('logs access denied events', () => {
    const entries: AuditLogEntry[] = [];
    const logger = createAuditLogger({ handler: (e) => entries.push(e) });

    logger.logAccessDenied({
      userId: 'u3',
      resource: '/admin/settings',
      requiredRole: 'admin',
    });

    expect(entries[0]!.eventType).toBe('ACCESS_DENIED');
    expect(entries[0]!.resource).toBe('/admin/settings');
    expect(entries[0]!.details).toEqual(
      expect.objectContaining({ requiredRole: 'admin' }),
    );
  });

  it('logs data modifications', () => {
    const entries: AuditLogEntry[] = [];
    const logger = createAuditLogger({ handler: (e) => entries.push(e) });

    logger.logDataModification({
      userId: 'u4',
      resource: 'users',
      action: 'update',
      details: { before: { name: 'old' }, after: { name: 'new' } },
    });

    expect(entries[0]!.eventType).toBe('DATA_MODIFICATION');
    expect(entries[0]!.action).toBe('update');
  });

  it('logs config changes', () => {
    const entries: AuditLogEntry[] = [];
    const logger = createAuditLogger({ handler: (e) => entries.push(e) });

    logger.logConfigChange({ resource: 'rate-limit', userId: 'admin1' });

    expect(entries[0]!.eventType).toBe('CONFIG_CHANGE');
    expect(entries[0]!.resource).toBe('rate-limit');
  });

  it('logs API key operations', () => {
    const entries: AuditLogEntry[] = [];
    const logger = createAuditLogger({ handler: (e) => entries.push(e) });

    logger.logApiKeyOperation({
      userId: 'u5',
      action: 'create',
      keyId: 'key-abc',
    });

    expect(entries[0]!.eventType).toBe('API_KEY_OPERATION');
    expect(entries[0]!.action).toBe('create');
    expect(entries[0]!.resource).toBe('key-abc');
  });

  it('defaults to console.log JSON output', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createAuditLogger();

    logger.logAuthAttempt({ success: true });

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string) as AuditLogEntry;
    expect(parsed.eventType).toBe('AUTH_ATTEMPT');

    spy.mockRestore();
  });

  it('includes ISO timestamp on every entry', () => {
    const entries: AuditLogEntry[] = [];
    const logger = createAuditLogger({ handler: (e) => entries.push(e) });

    logger.logAuthAttempt({ success: true });

    // Should be a valid ISO string
    expect(() => new Date(entries[0]!.timestamp)).not.toThrow();
    expect(new Date(entries[0]!.timestamp).toISOString()).toBe(entries[0]!.timestamp);
  });
});
