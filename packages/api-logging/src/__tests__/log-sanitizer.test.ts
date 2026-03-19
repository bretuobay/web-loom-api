import { describe, it, expect } from 'vitest';
import { LogSanitizer } from '../log-sanitizer';

describe('LogSanitizer', () => {
  const sanitizer = new LogSanitizer();

  describe('password redaction', () => {
    it('should redact password fields', () => {
      const result = sanitizer.sanitize({ password: 'my-secret-pass' });
      expect(result.password).toBe('[REDACTED]');
    });

    it('should redact secret fields', () => {
      const result = sanitizer.sanitize({ secret: 'top-secret-value' });
      expect(result.secret).toBe('[REDACTED]');
    });

    it('should redact token fields', () => {
      const result = sanitizer.sanitize({ token: 'jwt-token-value' });
      expect(result.token).toBe('[REDACTED]');
    });

    it('should redact authorization fields', () => {
      const result = sanitizer.sanitize({ authorization: 'Bearer xyz' });
      expect(result.authorization).toBe('[REDACTED]');
    });
  });

  describe('API key masking', () => {
    it('should mask API keys showing last 4 chars', () => {
      const result = sanitizer.sanitize({ apiKey: 'sk_live_abcdef1234' });
      expect(result.apiKey).toBe('****1234');
    });

    it('should mask api_key fields', () => {
      const result = sanitizer.sanitize({ api_key: 'key_abcdefgh5678' });
      expect(result.api_key).toBe('****5678');
    });

    it('should mask access_key fields', () => {
      const result = sanitizer.sanitize({ access_key: 'AKIAIOSFODNN7EXAMPLE' });
      expect(result.access_key).toBe('****MPLE');
    });
  });

  describe('credit card removal', () => {
    it('should remove credit card numbers with spaces', () => {
      const result = sanitizer.sanitize({ note: 'Card: 4111 1111 1111 1111' });
      expect(result.note).not.toContain('4111');
      expect(result.note).toContain('[CARD REMOVED]');
    });

    it('should remove credit card numbers with dashes', () => {
      const result = sanitizer.sanitize({ note: 'Card: 4111-1111-1111-1111' });
      expect(result.note).not.toContain('4111');
      expect(result.note).toContain('[CARD REMOVED]');
    });

    it('should remove credit card numbers without separators', () => {
      const result = sanitizer.sanitize({ note: 'Card: 4111111111111111' });
      expect(result.note).not.toContain('4111111111111111');
      expect(result.note).toContain('[CARD REMOVED]');
    });
  });

  describe('custom rules', () => {
    it('should apply additional sanitization rules', () => {
      const custom = new LogSanitizer([
        { pattern: /email@example\.com/g, replacement: '[EMAIL REDACTED]' },
      ]);
      const result = custom.sanitize({ contact: 'email@example.com' });
      expect(result.contact).toBe('[EMAIL REDACTED]');
    });
  });

  describe('preserves non-sensitive data', () => {
    it('should not modify non-sensitive fields', () => {
      const result = sanitizer.sanitize({
        message: 'Request completed',
        status: 200,
        path: '/users/123',
      });
      expect(result.message).toBe('Request completed');
      expect(result.status).toBe(200);
      expect(result.path).toBe('/users/123');
    });
  });
});
