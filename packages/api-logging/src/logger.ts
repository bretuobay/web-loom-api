import { randomUUID } from 'node:crypto';
import type { LogLevel, LogEntry, LoggerOptions, LogSanitizerInterface } from './types';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private level: LogLevel;
  private context: Record<string, unknown>;
  private output: (entry: LogEntry) => void;
  private sanitizer: LogSanitizerInterface | undefined;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.context = options.context ?? {};
    this.output = options.output ?? Logger.defaultOutput;
    this.sanitizer = options.sanitizer;
  }

  static generateRequestId(): string {
    return randomUUID();
  }

  private static defaultOutput(entry: LogEntry): void {
    process.stdout.write(JSON.stringify(entry) + '\n');
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    let entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...meta,
    };

    if (this.sanitizer) {
      entry = this.sanitizer.sanitize(entry) as LogEntry;
    }

    this.output(entry);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  child(context: Record<string, unknown>): Logger {
    return new Logger({
      level: this.level,
      context: { ...this.context, ...context },
      output: this.output,
      sanitizer: this.sanitizer ?? undefined,
    });
  }

  getLevel(): LogLevel {
    return this.level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}
