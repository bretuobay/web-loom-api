import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadEnvFiles, loadEnvVar, loadEnvVars } from '../env-loader';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Environment File Loading', () => {
  const testDir = resolve(__dirname, '__test-env__');
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Create test directory if it doesn't exist
    if (!existsSync(testDir)) {
      require('fs').mkdirSync(testDir, { recursive: true });
    }

    // Clear environment variables
    for (const key in process.env) {
      if (key.startsWith('TEST_')) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };

    // Clean up test files
    const files = ['.env', '.env.local', '.env.test', '.env.test.local'];
    for (const file of files) {
      const filePath = resolve(testDir, file);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }
  });

  describe('loadEnvFiles', () => {
    it('should load base .env file', () => {
      writeFileSync(resolve(testDir, '.env'), 'TEST_VAR=base\nTEST_VAR2=value2');

      const result = loadEnvFiles({ cwd: testDir });

      expect(result.loaded).toContain('.env');
      expect(result.parsed.TEST_VAR).toBe('base');
      expect(result.parsed.TEST_VAR2).toBe('value2');
    });

    it('should load environment-specific file', () => {
      writeFileSync(resolve(testDir, '.env'), 'TEST_VAR=base');
      writeFileSync(resolve(testDir, '.env.test'), 'TEST_VAR=test');

      const result = loadEnvFiles({
        cwd: testDir,
        environment: 'test',
      });

      expect(result.loaded).toContain('.env');
      expect(result.loaded).toContain('.env.test');
      expect(process.env.TEST_VAR).toBe('test'); // Later file overrides
    });

    it('should load files in correct order', () => {
      writeFileSync(resolve(testDir, '.env'), 'TEST_VAR=base');
      writeFileSync(resolve(testDir, '.env.local'), 'TEST_VAR=local');
      writeFileSync(resolve(testDir, '.env.test'), 'TEST_VAR=test');
      writeFileSync(resolve(testDir, '.env.test.local'), 'TEST_VAR=test-local');

      const result = loadEnvFiles({
        cwd: testDir,
        environment: 'test',
      });

      expect(result.loaded).toEqual(['.env', '.env.local', '.env.test', '.env.test.local']);
      expect(process.env.TEST_VAR).toBe('test-local'); // Last file wins
    });

    it('should handle missing files gracefully', () => {
      const result = loadEnvFiles({
        cwd: testDir,
        environment: 'production',
      });

      expect(result.loaded).toEqual([]);
      expect(result.notFound.length).toBeGreaterThan(0);
    });
  });

  describe('loadEnvVar', () => {
    it('should load and return specific variable', () => {
      writeFileSync(resolve(testDir, '.env'), 'TEST_VAR=value');

      const value = loadEnvVar('TEST_VAR', { cwd: testDir });

      expect(value).toBe('value');
    });

    it('should return undefined for missing variable', () => {
      const value = loadEnvVar('MISSING_VAR', { cwd: testDir });

      expect(value).toBeUndefined();
    });
  });

  describe('loadEnvVars', () => {
    it('should load and return multiple variables', () => {
      writeFileSync(
        resolve(testDir, '.env'),
        'TEST_VAR1=value1\nTEST_VAR2=value2\nTEST_VAR3=value3'
      );

      const vars = loadEnvVars(['TEST_VAR1', 'TEST_VAR2', 'TEST_VAR3'], {
        cwd: testDir,
      });

      expect(vars.TEST_VAR1).toBe('value1');
      expect(vars.TEST_VAR2).toBe('value2');
      expect(vars.TEST_VAR3).toBe('value3');
    });

    it('should include undefined for missing variables', () => {
      writeFileSync(resolve(testDir, '.env'), 'TEST_VAR1=value1');

      const vars = loadEnvVars(['TEST_VAR1', 'MISSING_VAR'], {
        cwd: testDir,
      });

      expect(vars.TEST_VAR1).toBe('value1');
      expect(vars.MISSING_VAR).toBeUndefined();
    });
  });
});
