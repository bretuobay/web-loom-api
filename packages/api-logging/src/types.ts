export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface LoggerOptions {
  level?: LogLevel | undefined;
  context?: Record<string, unknown> | undefined;
  output?: ((entry: LogEntry) => void) | undefined;
  sanitizer?: LogSanitizerInterface | undefined;
}

export interface LogSanitizerInterface {
  sanitize(data: Record<string, unknown>): Record<string, unknown>;
}

export interface SanitizationRule {
  pattern: RegExp;
  replacement: string | ((match: string) => string);
}
