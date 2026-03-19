import type { LogSanitizerInterface, SanitizationRule } from './types';

const PASSWORD_PATTERN =
  /("(?:password|passwd|secret|token|authorization|cookie|session)"\s*:\s*)"[^"]*"/gi;
const API_KEY_PATTERN =
  /("(?:api[_-]?key|apikey|access[_-]?key|secret[_-]?key)"\s*:\s*)"([^"]{4,})"/gi;
const CREDIT_CARD_PATTERN = /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,4})\b/g;

export class LogSanitizer implements LogSanitizerInterface {
  private rules: SanitizationRule[];

  constructor(additionalRules: SanitizationRule[] = []) {
    this.rules = additionalRules;
  }

  sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const json = JSON.stringify(data);
    let sanitized = json;

    // Redact passwords and secrets
    sanitized = sanitized.replace(PASSWORD_PATTERN, '$1"[REDACTED]"');

    // Mask API keys (show last 4 chars)
    sanitized = sanitized.replace(API_KEY_PATTERN, (_match, prefix: string, value: string) => {
      const last4 = value.slice(-4);
      return `${prefix}"****${last4}"`;
    });

    // Remove credit card numbers
    sanitized = sanitized.replace(CREDIT_CARD_PATTERN, '[CARD REMOVED]');

    // Apply custom rules
    for (const rule of this.rules) {
      sanitized = sanitized.replace(rule.pattern, rule.replacement as string);
    }

    return JSON.parse(sanitized) as Record<string, unknown>;
  }
}
