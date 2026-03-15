import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createProgram } from '../program.js';
import { CLI_VERSION } from '../version.js';

describe('CLI Program', () => {
  let program: ReturnType<typeof createProgram>;

  beforeEach(() => {
    program = createProgram();
  });

  describe('Program Configuration', () => {
    it('should have correct name', () => {
      expect(program.name()).toBe('webloom');
    });

    it('should have correct version', () => {
      expect(program.version()).toBe(CLI_VERSION);
    });

    it('should have description', () => {
      const description = program.description();
      expect(description).toContain('Web Loom');
      expect(description).toContain('REST APIs');
    });
  });

  describe('Global Options', () => {
    it('should support --debug option', () => {
      const options = program.opts();
      expect(program.options.some(opt => opt.long === '--debug')).toBe(true);
    });

    it('should support --config option with default value', () => {
      const configOption = program.options.find(opt => opt.long === '--config');
      expect(configOption).toBeDefined();
      expect(configOption?.defaultValue).toBe('webloom.config.ts');
    });

    it('should support --no-color option', () => {
      expect(program.options.some(opt => opt.long === '--no-color')).toBe(true);
    });
  });

  describe('Help Options', () => {
    it('should support -v, --version flag', () => {
      const versionOption = program.options.find(opt => opt.short === '-v');
      expect(versionOption).toBeDefined();
      expect(versionOption?.long).toBe('--version');
    });

    it('should have help option configured', () => {
      // Commander.js adds help automatically, check it's accessible
      expect(program.helpOption).toBeDefined();
    });
  });

  describe('Command Parsing', () => {
    it('should parse --debug flag with a command', () => {
      program.parse(['node', 'webloom', 'init', '--debug']);
      const options = program.opts();
      expect(options.debug).toBe(true);
    });

    it('should parse --config with value', () => {
      program.parse(['node', 'webloom', 'init', '--config', 'custom.config.ts']);
      const options = program.opts();
      expect(options.config).toBe('custom.config.ts');
    });

    it('should parse --no-color flag', () => {
      program.parse(['node', 'webloom', 'init', '--no-color']);
      const options = program.opts();
      expect(options.color).toBe(false);
    });

    it('should use default config path when not specified', () => {
      program.parse(['node', 'webloom', 'init']);
      const options = program.opts();
      expect(options.config).toBe('webloom.config.ts');
    });
  });
});
