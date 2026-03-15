/**
 * CLI Logger Utility
 * 
 * Provides colored console output for different log levels.
 * Respects --no-color flag and --debug mode.
 */

import chalk from 'chalk';

/**
 * Logger configuration
 */
interface LoggerConfig {
  debug: boolean;
  color: boolean;
}

let config: LoggerConfig = {
  debug: false,
  color: true,
};

/**
 * Configure logger settings
 */
export function configureLogger(options: Partial<LoggerConfig>): void {
  config = { ...config, ...options };
}

/**
 * Format message with optional color
 */
function format(message: string, colorFn: (text: string) => string): string {
  return config.color ? colorFn(message) : message;
}

/**
 * Log success message
 */
export function success(message: string): void {
  console.log(format(`✓ ${message}`, chalk.green));
}

/**
 * Log error message
 */
export function error(message: string): void {
  console.error(format(`✗ ${message}`, chalk.red));
}

/**
 * Log warning message
 */
export function warn(message: string): void {
  console.warn(format(`⚠ ${message}`, chalk.yellow));
}

/**
 * Log info message
 */
export function info(message: string): void {
  console.log(format(`ℹ ${message}`, chalk.blue));
}

/**
 * Log debug message (only if debug mode enabled)
 */
export function debug(message: string): void {
  if (config.debug) {
    console.log(format(`[DEBUG] ${message}`, chalk.gray));
  }
}

/**
 * Log plain message without formatting
 */
export function log(message: string): void {
  console.log(message);
}

/**
 * Create a spinner for long-running operations
 */
export async function withSpinner<T>(
  message: string,
  fn: () => Promise<T>
): Promise<T> {
  // Dynamic import to handle ESM module
  const ora = (await import('ora')).default;
  
  if (!config.color) {
    info(message);
    return fn();
  }

  const spinner = ora(message).start();
  
  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (err) {
    spinner.fail();
    throw err;
  }
}
