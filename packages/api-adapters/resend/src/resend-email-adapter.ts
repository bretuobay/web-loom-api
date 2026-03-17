import type {
  EmailAdapter,
  EmailMessage,
  EmailResult,
  DomainVerificationResult,
  DomainVerificationRecord,
} from '@web-loom/api-core';
import { InternalError } from '@web-loom/api-shared';

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------

export interface ResendEmailAdapterOptions {
  /** Resend API key (required unless testMode is true) */
  apiKey?: string;
  /** Base URL for the Resend API (default: https://api.resend.com) */
  baseUrl?: string;
  /** Enable test mode — no real API calls are made */
  testMode?: boolean;
  /** Default "from" address used when EmailMessage.from is omitted */
  defaultFrom?: string;
}

// --------------------------------------------------------------------------
// Internal Resend API response shapes
// --------------------------------------------------------------------------

interface ResendSendResponse {
  id: string;
}

interface ResendBatchResponse {
  data: ResendSendResponse[];
}

interface ResendDomainRecord {
  record: string;   // "TXT" | "CNAME" | "MX"
  name: string;
  value: string;
  priority?: number;
  status: string;    // "verified" | "not_started" | etc.
}

interface ResendDomainResponse {
  id: string;
  name: string;
  status: string;
  records: ResendDomainRecord[];
}


// --------------------------------------------------------------------------
// Test-mode in-memory store
// --------------------------------------------------------------------------

export interface SentEmail {
  id: string;
  message: EmailMessage;
  sentAt: Date;
}

// --------------------------------------------------------------------------
// ResendEmailAdapter
// --------------------------------------------------------------------------

export class ResendEmailAdapter implements EmailAdapter {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly testMode: boolean;
  private readonly defaultFrom: string | undefined;

  /** Emails captured in test mode (useful for assertions) */
  readonly sentEmails: SentEmail[] = [];

  private testIdCounter = 0;

  constructor(options: ResendEmailAdapterOptions = {}) {
    this.testMode = options.testMode ?? false;
    this.apiKey = options.apiKey ?? '';
    this.baseUrl = (options.baseUrl ?? 'https://api.resend.com').replace(/\/+$/, '');
    this.defaultFrom = options.defaultFrom;

    if (!this.testMode && !this.apiKey) {
      throw new InternalError('Resend API key is required when testMode is disabled');
    }
  }

  // -----------------------------------------------------------------------
  // EmailAdapter — send  (POST /emails)
  // Requirement 2.5, 22.1
  // -----------------------------------------------------------------------

  async send(email: EmailMessage): Promise<EmailResult> {
    const message = this.applyDefaults(email);

    if (this.testMode) {
      return this.recordTestEmail(message);
    }

    try {
      const body = this.toResendPayload(message);
      const res = await this.request<ResendSendResponse>('POST', '/emails', body);
      return { id: res.id, success: true };
    } catch (err) {
      return this.handleError(err);
    }
  }

  // -----------------------------------------------------------------------
  // EmailAdapter — sendBatch  (POST /emails/batch)
  // Requirement 22.2
  // -----------------------------------------------------------------------

  async sendBatch(emails: EmailMessage[]): Promise<EmailResult[]> {
    if (emails.length === 0) return [];

    const messages = emails.map((e) => this.applyDefaults(e));

    if (this.testMode) {
      return messages.map((m) => this.recordTestEmail(m));
    }

    try {
      const payloads = messages.map((m) => this.toResendPayload(m));
      const res = await this.request<ResendBatchResponse>('POST', '/emails/batch', payloads);
      return res.data.map((d) => ({ id: d.id, success: true }));
    } catch (err) {
      // If the batch call itself fails, mark every email as failed
      const result = this.handleError(err);
      return messages.map(() => ({ ...result }));
    }
  }


  // -----------------------------------------------------------------------
  // EmailAdapter — sendTemplate
  // Requirement 22.1
  // -----------------------------------------------------------------------

  async sendTemplate(
    templateId: string,
    to: string,
    variables: Record<string, unknown>,
  ): Promise<EmailResult> {
    // Resend doesn't have a first-class server-side template API.
    // We interpolate variables into a minimal HTML wrapper keyed by templateId.
    const html = this.interpolateTemplate(templateId, variables);
    return this.send({
      from: this.defaultFrom ?? '',
      to,
      subject: (variables['subject'] as string) ?? templateId,
      html,
    });
  }

  // -----------------------------------------------------------------------
  // EmailAdapter — verifyDomain  (POST /domains)
  // -----------------------------------------------------------------------

  async verifyDomain(domain: string): Promise<DomainVerificationResult> {
    if (this.testMode) {
      return {
        domain,
        verified: false,
        records: [
          { type: 'TXT', name: `_resend.${domain}`, value: 'test-verification-value' },
        ],
        message: 'Test mode — domain not actually verified',
      };
    }

    try {
      const res = await this.request<ResendDomainResponse>('POST', '/domains', { name: domain });
      const verified = res.status === 'verified';
      const records: DomainVerificationRecord[] = (res.records ?? []).map((r) => ({
        type: r.record as DomainVerificationRecord['type'],
        name: r.name,
        value: r.value,
        priority: r.priority,
        verified: r.status === 'verified',
      }));

      return { domain: res.name, verified, records, message: res.status };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Domain verification failed';
      return { domain, verified: false, message };
    }
  }

  // -----------------------------------------------------------------------
  // getDomains  (GET /domains) — bonus helper
  // -----------------------------------------------------------------------

  async getDomains(): Promise<DomainVerificationResult[]> {
    if (this.testMode) {
      return [];
    }

    const res = await this.request<{ data: ResendDomainResponse[] }>('GET', '/domains');
    return res.data.map((d) => ({
      domain: d.name,
      verified: d.status === 'verified',
      records: (d.records ?? []).map((r) => ({
        type: r.record as DomainVerificationRecord['type'],
        name: r.name,
        value: r.value,
        priority: r.priority,
        verified: r.status === 'verified',
      })),
      message: d.status,
    }));
  }

  // -----------------------------------------------------------------------
  // Test-mode helpers
  // -----------------------------------------------------------------------

  /** Clear captured emails (test mode only) */
  clearSentEmails(): void {
    this.sentEmails.length = 0;
    this.testIdCounter = 0;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private applyDefaults(email: EmailMessage): EmailMessage {
    if (!email.from && this.defaultFrom) {
      return { ...email, from: this.defaultFrom };
    }
    return email;
  }

  private recordTestEmail(message: EmailMessage): EmailResult {
    this.testIdCounter += 1;
    const id = `test_${this.testIdCounter}`;
    this.sentEmails.push({ id, message, sentAt: new Date() });
    return { id, success: true };
  }

  private toResendPayload(email: EmailMessage): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      from: email.from,
      to: Array.isArray(email.to) ? email.to : [email.to],
      subject: email.subject,
    };

    if (email.html !== undefined) payload['html'] = email.html;
    if (email.text !== undefined) payload['text'] = email.text;
    if (email.cc) payload['cc'] = Array.isArray(email.cc) ? email.cc : [email.cc];
    if (email.bcc) payload['bcc'] = Array.isArray(email.bcc) ? email.bcc : [email.bcc];
    if (email.replyTo) payload['reply_to'] = email.replyTo;
    if (email.headers) payload['headers'] = email.headers;
    if (email.tags) {
      payload['tags'] = Object.entries(email.tags).map(([name, value]) => ({ name, value }));
    }
    if (email.attachments) {
      payload['attachments'] = email.attachments.map((a) => ({
        filename: a.filename,
        content: typeof a.content === 'string' ? a.content : a.content.toString('base64'),
        content_type: a.contentType,
      }));
    }

    return payload;
  }

  private interpolateTemplate(templateId: string, variables: Record<string, unknown>): string {
    // Simple variable interpolation: {{key}} → value
    let html = `<!-- template: ${templateId} -->`;
    for (const [key, value] of Object.entries(variables)) {
      if (key === 'subject') continue;
      html += `<p><strong>${this.escapeHtml(key)}</strong>: ${this.escapeHtml(String(value ?? ''))}</p>`;
    }
    return html;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new InternalError(`Resend API error (${response.status}): ${text}`);
    }

    return (await response.json()) as T;
  }

  private handleError(err: unknown): EmailResult {
    const message = err instanceof Error ? err.message : 'Unknown email sending error';
    return { id: '', success: false, error: message };
  }
}
