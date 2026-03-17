import { describe, it, expect, _vi } from 'vitest';
import { Logger } from '../logger';
import { LogSanitizer } from '../log-sanitizer';
import type { LogEntry } from '../types';

function captureOutput(): { entries: LogEntry[]; output: (entry: LogEntry) => void } {
  const entries: LogEntry[] = [];
  return { entries, output: (entry: LogEntry) => entries.push(entry) };
}

describe('Logger', () => {
  describe('log levels', () => {
    it('should output logs at or above configured level', () => {
      const { entries, output } = captureOutput();
      const logger = new Logger({ level: 'warn', output });

      logger.debug('debug msg');
      logger.info('info msg');
      logger.warn('warn msg');
      logger.error('error msg');

      expect(entries).toHaveLength(2);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(entries[0]!.level).toBe('warn');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(entries[1]!.level).toBe('error');
    });

    it('should default to info level', () => {
      const { entries, output } = captureOutput();
      const logger = new Logger({ output });

      logger.debug('debug msg');
      logger.info('info msg');

      expect(entries).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(entries[0]!.level).toBe('info');
    });

    it('should allow changing log level at runtime', () => {
      const { entries, output } = captureOutput();
      const logger = new Logger({ level: 'error', output });

      logger.warn('should not appear');
      expect(entries).toHaveLength(0);

      logger.setLevel('warn');
      logger.warn('should appear');
      expect(entries).toHaveLength(1);
    });
  });

  describe('JSON output format', () => {
    it('should produce entries with timestamp, level, and message', () => {
      const { entries, output } = captureOutput();
      const logger = new Logger({ output });

      logger.info('test message');

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const entry = entries[0]!;
      expect(entry.timestamp).toBeDefined();
      expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
      expect(entry.level).toBe('info');
      expect(entry.message).toBe('test message');
    });

    it('should include additional metadata', () => {
      const { entries, output } = captureOutput();
      const logger = new Logger({ output });

      logger.info('request done', { status: 200, duration: 45 });

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(entries[0]!.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(entries[0]!.duration).toBe(45);
    });
  });

  describe('request ID', () => {
    it('should generate unique request IDs', () => {
      const id1 = Logger.generateRequestId();
      const id2 = Logger.generateRequestId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('should propagate requestId via context', () => {
      const { entries, output } = captureOutput();
      const requestId = Logger.generateRequestId();
      const logger = new Logger({ output, context: { requestId } });

      logger.info('hello');

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(entries[0]!.requestId).toBe(requestId);
    });
  });

  describe('child loggers', () => {
    it('should inherit parent context', () => {
      const { entries, output } = captureOutput();
      const parent = new Logger({ output, context: { service: 'api' } });
      const child = parent.child({ userId: 'u123' });

      child.info('child log');

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(entries[0]!.service).toBe('api');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(entries[0]!.userId).toBe('u123');
    });

    it('should inherit log level from parent', () => {
      const { entries, output } = captureOutput();
      const parent = new Logger({ level: 'error', output });
      const child = parent.child({ userId: 'u123' });

      child.warn('should not appear');
      child.error('should appear');

      expect(entries).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(entries[0]!.level).toBe('error');
    });

    it('should not affect parent context', () => {
      const { entries, output } = captureOutput();
      const parent = new Logger({ output, context: { service: 'api' } });
      parent.child({ userId: 'u123' });

      parent.info('parent log');

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(entries[0]!.userId).toBeUndefined();
    });
  });

  describe('sanitizer integration', () => {
    it('should sanitize log entries when sanitizer is provided', () => {
      const { entries, output } = captureOutput();
      const sanitizer = new LogSanitizer();
      const logger = new Logger({ output, sanitizer });

      logger.info('login', { password: 'secret123' });

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(entries[0]!.password).toBe('[REDACTED]');
    });

    it('should propagate sanitizer to child loggers', () => {
      const { entries, output } = captureOutput();
      const sanitizer = new LogSanitizer();
      const parent = new Logger({ output, sanitizer });
      const child = parent.child({ service: 'auth' });

      child.info('login', { password: 'secret123' });

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(entries[0]!.password).toBe('[REDACTED]');
    });
  });
});
