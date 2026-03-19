import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createGenerateClientCommand } from '../client.js';

describe('createGenerateClientCommand', () => {
  const originalCwd = process.cwd();
  let tempDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webloom-client-'));
    fs.mkdirSync(path.join(tempDir, 'src', 'routes', 'users'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src', 'routes', 'index.ts'), 'export const GET = true;');
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

  it('generates client files from discovered routes', async () => {
    const command = createGenerateClientCommand();

    await command.parseAsync([
      'node',
      'webloom',
      '--output',
      'generated/client',
      '--class-name',
      'CustomClient',
      '--base-url',
      'https://api.example.com',
    ]);

    const outputDir = path.join(tempDir, 'generated', 'client');
    const clientContent = fs.readFileSync(path.join(outputDir, 'client.ts'), 'utf8');
    const indexContent = fs.readFileSync(path.join(outputDir, 'index.ts'), 'utf8');

    expect(fs.existsSync(path.join(outputDir, 'types.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'utils.ts'))).toBe(true);
    expect(clientContent).toContain('class CustomClient');
    expect(clientContent).toContain('getUsersById');
    expect(indexContent).toContain("export * from './client';");
    expect(logSpy).toHaveBeenCalled();
  });

  it('generates optional files when hooks and errors are enabled', async () => {
    const command = createGenerateClientCommand();

    await command.parseAsync(['node', 'webloom', '--output', 'generated/with-hooks']);

    const outputDir = path.join(tempDir, 'generated', 'with-hooks');
    expect(fs.existsSync(path.join(outputDir, 'errors.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'hooks.ts'))).toBe(true);
  });
});
