import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createGenerateOpenAPICommand } from '../openapi.js';

describe('createGenerateOpenAPICommand', () => {
  const originalCwd = process.cwd();
  let tempDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webloom-openapi-'));
    fs.mkdirSync(path.join(tempDir, 'src', 'routes', 'users'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'src', 'routes', 'users', '[id].ts'),
      'export const GET = true;'
    );
    process.chdir(tempDir);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    logSpy.mockRestore();
    errorSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes yaml output and adjusts the extension', async () => {
    const command = createGenerateOpenAPICommand();

    await command.parseAsync([
      'node',
      'webloom',
      '--output',
      'docs/openapi.tmp',
      '--format',
      'yaml',
      '--title',
      'Coverage API',
    ]);

    const outputPath = path.join(tempDir, 'docs', 'openapi.yaml');
    const content = fs.readFileSync(outputPath, 'utf8');

    expect(fs.existsSync(outputPath)).toBe(true);
    expect(content).toContain('openapi: 3.1.0');
    expect(content).toContain('/users/{id}:');
    expect(logSpy).toHaveBeenCalled();
  });

  it('writes json output and preserves the json extension', async () => {
    const command = createGenerateOpenAPICommand();

    await command.parseAsync([
      'node',
      'webloom',
      '--output',
      'docs/openapi.custom',
      '--format',
      'json',
      '--version',
      '2.1.0',
    ]);

    const outputPath = path.join(tempDir, 'docs', 'openapi.json');
    const content = fs.readFileSync(outputPath, 'utf8');
    const spec = JSON.parse(content) as {
      openapi: string;
      info: { version: string };
      paths: Record<string, unknown>;
    };

    expect(fs.existsSync(outputPath)).toBe(true);
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.version).toBe('2.1.0');
    expect(spec.paths['/users/{id}']).toBeDefined();
  });
});
