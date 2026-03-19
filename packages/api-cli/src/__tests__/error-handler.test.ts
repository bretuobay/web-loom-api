import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CLIError, handleError, wrapCommand } from '../utils/error-handler.js';

describe('Error Handler', () => {
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('CLIError', () => {
    it('should create error with message', () => {
      const error = new CLIError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('CLIError');
    });

    it('should have default exit code of 1', () => {
      const error = new CLIError('Test error');
      expect(error.exitCode).toBe(1);
    });

    it('should accept custom exit code', () => {
      const error = new CLIError('Test error', 2);
      expect(error.exitCode).toBe(2);
    });
  });

  describe('handleError', () => {
    it('should handle CLIError and exit with correct code', () => {
      const error = new CLIError('CLI error', 2);
      handleError(error, false);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(2);
    });

    it('should handle generic Error and exit with code 1', () => {
      const error = new Error('Generic error');
      handleError(error, false);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle unknown errors', () => {
      handleError('string error', false);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should show stack trace in debug mode', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const error = new Error('Test error');
      error.stack = 'Stack trace';

      handleError(error, true);

      consoleLogSpy.mockRestore();
    });
  });

  describe('wrapCommand', () => {
    it('should execute command successfully', async () => {
      const mockFn = vi.fn().mockResolvedValue(undefined);
      const wrapped = wrapCommand(mockFn);

      await wrapped('arg1', 'arg2');

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should catch and handle errors', async () => {
      const mockFn = vi.fn().mockRejectedValue(new CLIError('Command failed'));
      const wrapped = wrapCommand(mockFn);

      await wrapped();

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should pass arguments correctly', async () => {
      const mockFn = vi.fn().mockResolvedValue(undefined);
      const wrapped = wrapCommand(mockFn);

      await wrapped('a', 'b', 'c');

      expect(mockFn).toHaveBeenCalledWith('a', 'b', 'c');
    });
  });
});
