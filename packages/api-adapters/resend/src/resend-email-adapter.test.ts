import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ResendEmailAdapter } from './resend-email-adapter';
import type { EmailMessage } from '@web-loom/api-core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEmail(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    from: 'sender@example.com',
    to: 'recipient@example.com',
    subject: 'Test Subject',
    html: '<p>Hello</p>',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResendEmailAdapter', () => {
  // -----------------------------------------------------------------------
  // Construction
  // -----------------------------------------------------------------------

  describe('constructor', () => {
    it('throws when apiKey is missing and testMode is false', () => {
      expect(() => new ResendEmailAdapter()).toThrow('API key is required');
    });

    it('does not throw in testMode without apiKey', () => {
      expect(() => new ResendEmailAdapter({ testMode: true })).not.toThrow();
    });

    it('does not throw when apiKey is provided', () => {
      expect(() => new ResendEmailAdapter({ apiKey: 'key_123' })).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Test-mode email sending
  // -----------------------------------------------------------------------

  describe('send (test mode)', () => {
    let adapter: ResendEmailAdapter;

    beforeEach(() => {
      adapter = new ResendEmailAdapter({ testMode: true, defaultFrom: 'default@example.com' });
    });

    it('sends an email and returns a result with id', async () => {
      const result = await adapter.send(makeEmail());
      expect(result.success).toBe(true);
      expect(result.id).toBe('test_1');
    });

    it('captures sent emails for inspection', async () => {
      await adapter.send(makeEmail({ subject: 'First' }));
      await adapter.send(makeEmail({ subject: 'Second' }));
      expect(adapter.sentEmails).toHaveLength(2);
      expect(adapter.sentEmails[0]!.message.subject).toBe('First');
      expect(adapter.sentEmails[1]!.message.subject).toBe('Second');
    });

    it('applies defaultFrom when from is empty', async () => {
      await adapter.send(makeEmail({ from: '' }));
      expect(adapter.sentEmails[0]!.message.from).toBe('default@example.com');
    });

    it('preserves explicit from over defaultFrom', async () => {
      await adapter.send(makeEmail({ from: 'explicit@example.com' }));
      expect(adapter.sentEmails[0]!.message.from).toBe('explicit@example.com');
    });

    it('increments test IDs', async () => {
      const r1 = await adapter.send(makeEmail());
      const r2 = await adapter.send(makeEmail());
      expect(r1.id).toBe('test_1');
      expect(r2.id).toBe('test_2');
    });
  });

  // -----------------------------------------------------------------------
  // Test-mode batch sending
  // -----------------------------------------------------------------------

  describe('sendBatch (test mode)', () => {
    let adapter: ResendEmailAdapter;

    beforeEach(() => {
      adapter = new ResendEmailAdapter({ testMode: true });
    });

    it('returns empty array for empty input', async () => {
      const results = await adapter.sendBatch([]);
      expect(results).toEqual([]);
    });

    it('sends multiple emails and returns results', async () => {
      const results = await adapter.sendBatch([
        makeEmail({ subject: 'A' }),
        makeEmail({ subject: 'B' }),
        makeEmail({ subject: 'C' }),
      ]);
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(adapter.sentEmails).toHaveLength(3);
    });
  });

  // -----------------------------------------------------------------------
  // Test-mode template sending
  // -----------------------------------------------------------------------

  describe('sendTemplate (test mode)', () => {
    let adapter: ResendEmailAdapter;

    beforeEach(() => {
      adapter = new ResendEmailAdapter({ testMode: true, defaultFrom: 'noreply@example.com' });
    });

    it('sends a template email with interpolated variables', async () => {
      const result = await adapter.sendTemplate('welcome', 'user@example.com', {
        subject: 'Welcome!',
        name: 'Alice',
      });
      expect(result.success).toBe(true);
      expect(adapter.sentEmails).toHaveLength(1);
      const sent = adapter.sentEmails[0]!;
      expect(sent.message.to).toBe('user@example.com');
      expect(sent.message.subject).toBe('Welcome!');
      expect(sent.message.html).toContain('template: welcome');
      expect(sent.message.html).toContain('Alice');
    });

    it('uses templateId as subject when subject variable is missing', async () => {
      await adapter.sendTemplate('reset-password', 'user@example.com', { token: 'abc' });
      expect(adapter.sentEmails[0]!.message.subject).toBe('reset-password');
    });
  });

  // -----------------------------------------------------------------------
  // Test-mode domain verification
  // -----------------------------------------------------------------------

  describe('verifyDomain (test mode)', () => {
    let adapter: ResendEmailAdapter;

    beforeEach(() => {
      adapter = new ResendEmailAdapter({ testMode: true });
    });

    it('returns unverified result with DNS records', async () => {
      const result = await adapter.verifyDomain('example.com');
      expect(result.domain).toBe('example.com');
      expect(result.verified).toBe(false);
      expect(result.records).toBeDefined();
      expect(result.records!.length).toBeGreaterThan(0);
      expect(result.records![0]!.type).toBe('TXT');
    });
  });

  // -----------------------------------------------------------------------
  // Test-mode getDomains
  // -----------------------------------------------------------------------

  describe('getDomains (test mode)', () => {
    it('returns empty array in test mode', async () => {
      const adapter = new ResendEmailAdapter({ testMode: true });
      const domains = await adapter.getDomains();
      expect(domains).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // clearSentEmails
  // -----------------------------------------------------------------------

  describe('clearSentEmails', () => {
    it('clears captured emails and resets counter', async () => {
      const adapter = new ResendEmailAdapter({ testMode: true });
      await adapter.send(makeEmail());
      await adapter.send(makeEmail());
      expect(adapter.sentEmails).toHaveLength(2);

      adapter.clearSentEmails();
      expect(adapter.sentEmails).toHaveLength(0);

      const result = await adapter.send(makeEmail());
      expect(result.id).toBe('test_1');
    });
  });

  // -----------------------------------------------------------------------
  // Live-mode with mocked fetch (send)
  // -----------------------------------------------------------------------

  describe('send (live mode with mocked fetch)', () => {
    let adapter: ResendEmailAdapter;

    beforeEach(() => {
      adapter = new ResendEmailAdapter({ apiKey: 'test_key_123' });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls Resend API and returns success', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ id: 'resend_abc123' }),
        })
      );

      const result = await adapter.send(makeEmail());
      expect(result.success).toBe(true);
      expect(result.id).toBe('resend_abc123');

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = vi.mocked(fetch).mock.calls[0]!;
      expect(url).toBe('https://api.resend.com/emails');
      expect(init!.method).toBe('POST');
      expect((init!.headers as Record<string, string>)['Authorization']).toBe(
        'Bearer test_key_123'
      );

      const body = JSON.parse(init!.body as string);
      expect(body.from).toBe('sender@example.com');
      expect(body.to).toEqual(['recipient@example.com']);
      expect(body.subject).toBe('Test Subject');
    });

    it('returns failure result on API error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 422,
          text: async () => '{"message":"Invalid email"}',
        })
      );

      const result = await adapter.send(makeEmail());
      expect(result.success).toBe(false);
      expect(result.error).toContain('422');
    });

    it('maps cc, bcc, replyTo, tags, and attachments correctly', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ id: 'resend_full' }),
        })
      );

      await adapter.send(
        makeEmail({
          cc: 'cc@example.com',
          bcc: ['bcc1@example.com', 'bcc2@example.com'],
          replyTo: 'reply@example.com',
          tags: { campaign: 'welcome' },
          attachments: [
            { filename: 'doc.pdf', content: 'base64data', contentType: 'application/pdf' },
          ],
        })
      );

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
      expect(body.cc).toEqual(['cc@example.com']);
      expect(body.bcc).toEqual(['bcc1@example.com', 'bcc2@example.com']);
      expect(body.reply_to).toBe('reply@example.com');
      expect(body.tags).toEqual([{ name: 'campaign', value: 'welcome' }]);
      expect(body.attachments[0].filename).toBe('doc.pdf');
    });
  });

  // -----------------------------------------------------------------------
  // Live-mode with mocked fetch (sendBatch)
  // -----------------------------------------------------------------------

  describe('sendBatch (live mode with mocked fetch)', () => {
    let adapter: ResendEmailAdapter;

    beforeEach(() => {
      adapter = new ResendEmailAdapter({ apiKey: 'test_key_123' });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls batch endpoint and returns results', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ data: [{ id: 'b1' }, { id: 'b2' }] }),
        })
      );

      const results = await adapter.sendBatch([makeEmail(), makeEmail()]);
      expect(results).toHaveLength(2);
      expect(results[0]!.id).toBe('b1');
      expect(results[1]!.id).toBe('b2');

      const [url] = vi.mocked(fetch).mock.calls[0]!;
      expect(url).toBe('https://api.resend.com/emails/batch');
    });

    it('returns failure for all emails on batch API error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        })
      );

      const results = await adapter.sendBatch([makeEmail(), makeEmail()]);
      expect(results).toHaveLength(2);
      expect(results.every((r) => !r.success)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Live-mode with mocked fetch (verifyDomain)
  // -----------------------------------------------------------------------

  describe('verifyDomain (live mode with mocked fetch)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns verified domain with records', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            id: 'dom_1',
            name: 'example.com',
            status: 'verified',
            records: [
              { record: 'TXT', name: '_resend.example.com', value: 'v=spf1', status: 'verified' },
            ],
          }),
        })
      );

      const adapter = new ResendEmailAdapter({ apiKey: 'key' });
      const result = await adapter.verifyDomain('example.com');
      expect(result.verified).toBe(true);
      expect(result.domain).toBe('example.com');
      expect(result.records).toHaveLength(1);
      expect(result.records![0]!.verified).toBe(true);
    });

    it('returns unverified on API error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: async () => 'Bad request',
        })
      );

      const adapter = new ResendEmailAdapter({ apiKey: 'key' });
      const result = await adapter.verifyDomain('bad.com');
      expect(result.verified).toBe(false);
      expect(result.message).toBeDefined();
    });
  });
});
