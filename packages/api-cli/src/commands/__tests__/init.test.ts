import { describe, it, expect, _vi, beforeEach } from 'vitest';
import { createInitCommand } from '../init.js';

describe('Init Command', () => {
  let command: ReturnType<typeof createInitCommand>;

  beforeEach(() => {
    command = createInitCommand();
  });

  describe('Command Configuration', () => {
    it('should have correct name', () => {
      expect(command.name()).toBe('init');
    });

    it('should have description', () => {
      const description = command.description();
      expect(description).toContain('Initialize');
      expect(description).toContain('Web Loom');
    });

    it('should support --name option', () => {
      const nameOption = command.options.find(opt => opt.long === '--name');
      expect(nameOption).toBeDefined();
      expect(nameOption?.short).toBe('-n');
    });

    it('should support --template option', () => {
      const templateOption = command.options.find(opt => opt.long === '--template');
      expect(templateOption).toBeDefined();
      expect(templateOption?.short).toBe('-t');
    });

    it('should support --skip-install option', () => {
      const skipInstallOption = command.options.find(opt => opt.long === '--skip-install');
      expect(skipInstallOption).toBeDefined();
    });

    it('should support --package-manager option', () => {
      const pmOption = command.options.find(opt => opt.long === '--package-manager');
      expect(pmOption).toBeDefined();
    });
  });

  describe('Option Parsing', () => {
    it('should parse --name option', () => {
      command.parse(['node', 'webloom', 'init', '--name', 'my-project']);
      const options = command.opts();
      expect(options.name).toBe('my-project');
    });

    it('should parse --template option', () => {
      command.parse(['node', 'webloom', 'init', '--template', 'serverless']);
      const options = command.opts();
      expect(options.template).toBe('serverless');
    });

    it('should parse --skip-install flag', () => {
      command.parse(['node', 'webloom', 'init', '--skip-install']);
      const options = command.opts();
      expect(options.skipInstall).toBe(true);
    });

    it('should parse --package-manager option', () => {
      command.parse(['node', 'webloom', 'init', '--package-manager', 'yarn']);
      const options = command.opts();
      expect(options.packageManager).toBe('yarn');
    });

    it('should parse multiple options together', () => {
      command.parse([
        'node',
        'webloom',
        'init',
        '--name',
        'test-api',
        '--template',
        'minimal',
        '--skip-install',
        '--package-manager',
        'pnpm',
      ]);
      const options = command.opts();
      expect(options.name).toBe('test-api');
      expect(options.template).toBe('minimal');
      expect(options.skipInstall).toBe(true);
      expect(options.packageManager).toBe('pnpm');
    });
  });

  describe('Template Types', () => {
    it('should accept minimal template', () => {
      command.parse(['node', 'webloom', 'init', '--template', 'minimal']);
      const options = command.opts();
      expect(options.template).toBe('minimal');
    });

    it('should accept serverless template', () => {
      command.parse(['node', 'webloom', 'init', '--template', 'serverless']);
      const options = command.opts();
      expect(options.template).toBe('serverless');
    });

    it('should accept full-stack template', () => {
      command.parse(['node', 'webloom', 'init', '--template', 'full-stack']);
      const options = command.opts();
      expect(options.template).toBe('full-stack');
    });
  });

  describe('Package Managers', () => {
    it('should accept npm', () => {
      command.parse(['node', 'webloom', 'init', '--package-manager', 'npm']);
      const options = command.opts();
      expect(options.packageManager).toBe('npm');
    });

    it('should accept yarn', () => {
      command.parse(['node', 'webloom', 'init', '--package-manager', 'yarn']);
      const options = command.opts();
      expect(options.packageManager).toBe('yarn');
    });

    it('should accept pnpm', () => {
      command.parse(['node', 'webloom', 'init', '--package-manager', 'pnpm']);
      const options = command.opts();
      expect(options.packageManager).toBe('pnpm');
    });
  });
});
