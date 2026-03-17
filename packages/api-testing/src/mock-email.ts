/**
 * Mock email adapter for testing
 */

export interface EmailMessage {
  to: string | string[];
  from?: string;
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string | Buffer }>;
  sentAt: Date;
}

export type SendEmailOptions = Omit<EmailMessage, 'sentAt'>;

export interface MockEmail {
  /** Send (record) an email */
  send(options: SendEmailOptions): EmailMessage;
  /** Get all sent emails */
  getSentEmails(): EmailMessage[];
  /** Get the most recently sent email */
  getLastEmail(): EmailMessage | undefined;
  /** Get emails sent to a specific address */
  getEmailsTo(address: string): EmailMessage[];
  /** Reset all recorded emails */
  reset(): void;
}

export function createMockEmail(): MockEmail {
  let emails: EmailMessage[] = [];

  const mock: MockEmail = {
    send(options: SendEmailOptions): EmailMessage {
      const message: EmailMessage = {
        ...options,
        sentAt: new Date(),
      };
      emails.push(message);
      return message;
    },

    getSentEmails(): EmailMessage[] {
      return [...emails];
    },

    getLastEmail(): EmailMessage | undefined {
      return emails.length > 0 ? emails[emails.length - 1] : undefined;
    },

    getEmailsTo(address: string): EmailMessage[] {
      return emails.filter((e) => {
        const recipients = Array.isArray(e.to) ? e.to : [e.to];
        return recipients.includes(address);
      });
    },

    reset(): void {
      emails = [];
    },
  };

  return mock;
}
