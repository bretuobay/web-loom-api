/**
 * Email Adapter Interface
 *
 * Abstracts email service providers (e.g., Resend, SendGrid, AWS SES) to provide
 * a unified interface for sending emails, managing templates, and domain verification.
 *
 * This adapter enables the framework to support multiple email providers,
 * allowing developers to choose their preferred email service.
 *
 * **Default Implementation:** Resend (modern API with excellent DX)
 * **Alternative Implementations:** SendGrid, AWS SES, Postmark
 *
 * @example
 * ```typescript
 * const adapter = new ResendAdapter();
 *
 * // Send a simple email
 * const result = await adapter.send({
 *   from: 'noreply@example.com',
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 *   html: '<h1>Welcome to our platform</h1>'
 * });
 *
 * // Send using a template
 * await adapter.sendTemplate('welcome-email', 'user@example.com', {
 *   name: 'John Doe',
 *   verificationUrl: 'https://example.com/verify/abc123'
 * });
 * ```
 *
 * **Requirements:** 2.5, 22.1, 22.2
 */
export interface EmailAdapter {
  /**
   * Send a single email
   *
   * Sends an email with HTML and/or plain text content, optional attachments,
   * and custom headers.
   *
   * @param email - Email message to send
   * @returns Promise resolving to email result with ID and status
   *
   * @throws {InternalError} If email sending fails
   *
   * @example
   * ```typescript
   * const result = await adapter.send({
   *   from: 'noreply@example.com',
   *   to: 'user@example.com',
   *   subject: 'Password Reset',
   *   html: '<p>Click here to reset your password: <a href="...">Reset</a></p>',
   *   text: 'Click here to reset your password: ...'
   * });
   *
   * console.log('Email sent with ID:', result.id);
   * ```
   */
  send(email: EmailMessage): Promise<EmailResult>;

  /**
   * Send multiple emails in a batch
   *
   * Sends multiple emails efficiently using provider's batch API.
   * Useful for sending notifications to multiple users.
   *
   * @param emails - Array of email messages to send
   * @returns Promise resolving to array of email results
   *
   * @example
   * ```typescript
   * const results = await adapter.sendBatch([
   *   { from: 'noreply@example.com', to: 'user1@example.com', subject: 'Hello', html: '...' },
   *   { from: 'noreply@example.com', to: 'user2@example.com', subject: 'Hello', html: '...' }
   * ]);
   *
   * const failed = results.filter(r => !r.success);
   * console.log(`Sent ${results.length - failed.length} emails, ${failed.length} failed`);
   * ```
   */
  sendBatch(emails: EmailMessage[]): Promise<EmailResult[]>;

  /**
   * Send an email using a template
   *
   * Renders an email template with provided variables and sends it.
   * Templates are typically configured in the email provider's dashboard.
   *
   * @param templateId - Template identifier
   * @param to - Recipient email address
   * @param variables - Template variables for substitution
   * @returns Promise resolving to email result
   *
   * @example
   * ```typescript
   * await adapter.sendTemplate('welcome-email', 'user@example.com', {
   *   userName: 'John Doe',
   *   verificationUrl: 'https://example.com/verify/abc123',
   *   supportEmail: 'support@example.com'
   * });
   * ```
   */
  sendTemplate(
    templateId: string,
    to: string,
    variables: Record<string, unknown>
  ): Promise<EmailResult>;

  /**
   * Verify domain ownership for sending emails
   *
   * Checks DNS records to verify domain is properly configured for sending.
   * Required before sending emails from custom domains.
   *
   * @param domain - Domain to verify (e.g., 'example.com')
   * @returns Promise resolving to verification result
   *
   * @example
   * ```typescript
   * const result = await adapter.verifyDomain('example.com');
   *
   * if (!result.verified) {
   *   console.log('Add these DNS records:', result.records);
   * }
   * ```
   */
  verifyDomain(domain: string): Promise<DomainVerificationResult>;
}

/**
 * Email message structure
 *
 * Defines the content and metadata for an email to be sent.
 */
export interface EmailMessage {
  /** Sender email address (must be verified domain) */
  from: string;

  /** Recipient email address(es) */
  to: string | string[];

  /** Email subject line */
  subject: string;

  /** HTML email body (optional if text is provided) */
  html?: string;

  /** Plain text email body (optional if html is provided) */
  text?: string;

  /** CC recipients */
  cc?: string | string[];

  /** BCC recipients */
  bcc?: string | string[];

  /** Reply-To email address */
  replyTo?: string;

  /** File attachments */
  attachments?: Attachment[];

  /** Custom email headers */
  headers?: Record<string, string>;

  /** Email tags for tracking/categorization */
  tags?: Record<string, string>;
}

/**
 * Email attachment
 *
 * Represents a file attachment to include in an email.
 */
export interface Attachment {
  /** Filename to display in email client */
  filename: string;

  /** File content as string or Buffer */
  content: string | Buffer;

  /** MIME content type (e.g., 'application/pdf', 'image/png') */
  contentType?: string;

  /** Content-ID for inline images (e.g., 'logo' for <img src="cid:logo">) */
  cid?: string;
}

/**
 * Email sending result
 *
 * Contains the outcome of an email send operation.
 */
export interface EmailResult {
  /** Unique email identifier from provider */
  id: string;

  /** Whether email was sent successfully */
  success: boolean;

  /** Error message if sending failed */
  error?: string;

  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Domain verification result
 *
 * Contains domain verification status and required DNS records.
 */
export interface DomainVerificationResult {
  /** Domain being verified */
  domain: string;

  /** Whether domain is verified and ready for sending */
  verified: boolean;

  /** DNS records that need to be added (if not verified) */
  records?: DomainVerificationRecord[];

  /** Verification status message */
  message?: string;
}

/**
 * DNS record for domain verification
 */
export interface DomainVerificationRecord {
  /** Record type (TXT, CNAME, MX) */
  type: 'TXT' | 'CNAME' | 'MX';

  /** Record name/host */
  name: string;

  /** Record value */
  value: string;

  /** Record priority (for MX records) */
  priority?: number;

  /** Whether this record is verified */
  verified?: boolean;
}
