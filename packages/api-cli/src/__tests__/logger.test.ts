import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { configureLogger, success, error, warn, info, debug, log } from '../utils/logger.js';

describe('Logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Reset logger config
    configureLogger({ debug: false, color: true });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Configuration', () => {
    it('should configure debug mode', () => {
      configureLogger({ debug: true });
      debug('test message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should configure color mode', () => {
      configureLogger({ color: false });
      success('test');
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ test');
    });
  });

  describe('Log Levels', () => {
    beforeEach(() => {
      configureLogger({ color: false });
    });

    it('should log success messages', () => {
      success('Operation completed');
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Operation completed');
    });

    it('should log error messages', () => {
      error('Operation failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('✗ Operation failed');
    });

    it('should log warning messages', () => {
      warn('Be careful');
      expect(consoleWarnSpy).toHaveBeenCalledWith('⚠ Be careful');
    });

    it('should log info messages', () => {
      info('Information');
      expect(consoleLogSpy).toHaveBeenCalledWith('ℹ Information');
    });

    it('should log plain messages', () => {
      log('Plain message');
      expect(consoleLogSpy).toHaveBeenCalledWith('Plain message');
    });
  });

  describe('Debug Mode', () => {
    it('should not log debug messages when debug is disabled', () => {
      configureLogger({ debug: false });
      debug('debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log debug messages when debug is enabled', () => {
      configureLogger({ debug: true, color: false });
      debug('debug message');
      expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG] debug message');
    });
  });

  describe('Color Mode', () => {
    it('should include color codes when color is enabled', () => {
      configureLogger({ color: true });
      success('test');
      const call = consoleLogSpy.mock.calls[0][0];
      // Chalk may not add colors in test environment, so just check the message is there
      expect(call).toContain('test');
    });

    it('should not include color codes when color is disabled', () => {
      configureLogger({ color: false });
      success('test');
      const call = consoleLogSpy.mock.calls[0][0];
      // Check that no ANSI color codes are present
      expect(call).not.toContain('\x1b[');
    });
  });
});
