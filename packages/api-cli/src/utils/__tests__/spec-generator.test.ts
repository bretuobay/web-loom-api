import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateOpenAPISpec } from '../spec-generator.js';

describe('generateOpenAPISpec', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webloom-spec-'));
    fs.mkdirSync(path.join(tempDir, 'src', 'routes', 'users'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src', 'routes', 'index.ts'), 'export const GET = true;');
    fs.writeFileSync(
      path.join(tempDir, 'src', 'routes', 'users', '[id].ts'),
      'export const GET = true;'
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('discovers routes and returns an OpenAPI JSON document', () => {
    const specJson = generateOpenAPISpec({
      title: 'Spec Test API',
      version: '2.0.0',
      description: 'Generated in tests',
      projectRoot: tempDir,
    });

    const spec = JSON.parse(specJson) as {
      info: { title: string; version: string; description: string };
      paths: Record<string, { get?: { tags?: string[]; summary?: string } }>;
    };

    expect(spec.info).toEqual({
      title: 'Spec Test API',
      version: '2.0.0',
      description: 'Generated in tests',
    });
    expect(spec.paths['/']).toBeDefined();
    expect(spec.paths['/users/{id}']?.get?.tags).toContain('users');
    expect(spec.paths['/users/{id}']?.get?.summary).toContain('users/[id].ts');
  });

  it('returns a valid document when the project has no routes', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webloom-empty-spec-'));

    try {
      const specJson = generateOpenAPISpec({ projectRoot: emptyDir });
      const spec = JSON.parse(specJson) as { paths: Record<string, unknown> };
      expect(spec.paths).toEqual({});
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
