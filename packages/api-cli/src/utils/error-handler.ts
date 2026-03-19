/**
 * CLI Error Handler
 *
 * Centralized error handling for CLI commands.
 * Formats errors and exits with appropriate status codes.
 */

import { error, debug } from './logger.js';

/**
 * CLI Error class
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public exitCode: number = 1
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * Handle CLI errors and exit
 */
export function handleError(err: unknown, debugMode: boolean = false): never {
  if (err instanceof CLIError) {
    error(err.message);
    if (debugMode && err.stack) {
      debug(err.stack);
    }
    process.exit(err.exitCode);
  }

  if (err instanceof Error) {
    error(`Unexpected error: ${err.message}`);
    if (debugMode && err.stack) {
      debug(err.stack);
    }
    process.exit(1);
  }

  error('An unknown error occurred');
  process.exit(1);
}

/**
 * Wrap async command handler with error handling
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapCommand<T extends any[]>(
  fn: (...args: T) => Promise<void>
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (err) {
      // Check if debug mode is enabled from global options
      const debugMode = process.argv.includes('--debug');
      handleError(err, debugMode);
    }
  };
}
