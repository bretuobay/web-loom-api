import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RouteDiscovery } from '../route-discovery';
import { RouteRegistry } from '../route-registry';

describe('RouteDiscovery', () => {
  let registry: RouteRegistry;
  let discovery: RouteDiscovery;
  let testDir: string;

  beforeEach(() => {
    registry = new RouteRegistry();
    discovery = new RouteDiscovery(registry);
    
    // Create a temporary test directory
    testDir = path.join(process.cwd(), 'test-routes-' + Date.now());
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('discover()', () => {
    it('should throw error if routes directory does not exist', async () => {
      await expect(discovery.discover('./non-existent-dir')).rejects.toThrow(
        'Routes directory not found'
      );
    });

    it('should discover routes from index.ts file', async () => {
      // Create index.ts with GET handler
      const indexFile = path.join(testDir, 'index.ts');
      fs.writeFileSync(
        indexFile,
        `export async function GET() { return new Response('Home'); }`
      );

      await discovery.discover(testDir);

      expect(registry.has('/', 'GET')).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it('should discover routes from named files', async () => {
      // Create users.ts with GET and POST handlers
      const usersFile = path.join(testDir, 'users.ts');
      fs.writeFileSync(
        usersFile,
        `
        export async function GET() { return new Response('List users'); }
        export async function POST() { return new Response('Create user'); }
        `
      );

      await discovery.discover(testDir);

      expect(registry.has('/users', 'GET')).toBe(true);
      expect(registry.has('/users', 'POST')).toBe(true);
      expect(registry.size()).toBe(2);
    });

    it('should discover routes from nested directories', async () => {
      // Create users/posts.ts
      const usersDir = path.join(testDir, 'users');
      fs.mkdirSync(usersDir);
      const postsFile = path.join(usersDir, 'posts.ts');
      fs.writeFileSync(
        postsFile,
        `export async function GET() { return new Response('User posts'); }`
      );

      await discovery.discover(testDir);

      expect(registry.has('/users/posts', 'GET')).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it('should map dynamic segments [id] to :id', async () => {
      // Create users/[id].ts
      const usersDir = path.join(testDir, 'users');
      fs.mkdirSync(usersDir);
      const idFile = path.join(usersDir, '[id].ts');
      fs.writeFileSync(
        idFile,
        `
        export async function GET() { return new Response('Get user'); }
        export async function PUT() { return new Response('Update user'); }
        export async function DELETE() { return new Response('Delete user'); }
        `
      );

      await discovery.discover(testDir);

      expect(registry.has('/users/:id', 'GET')).toBe(true);
      expect(registry.has('/users/:id', 'PUT')).toBe(true);
      expect(registry.has('/users/:id', 'DELETE')).toBe(true);
      expect(registry.size()).toBe(3);
    });

    it('should map catch-all routes [...path] to *', async () => {
      // Create [...path].ts
      const catchAllFile = path.join(testDir, '[...path].ts');
      fs.writeFileSync(
        catchAllFile,
        `export async function GET() { return new Response('Catch all'); }`
      );

      await discovery.discover(testDir);

      expect(registry.has('/*', 'GET')).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it('should support nested dynamic segments', async () => {
      // Create users/[id]/posts/[postId].ts
      const usersDir = path.join(testDir, 'users', '[id]', 'posts');
      fs.mkdirSync(usersDir, { recursive: true });
      const postFile = path.join(usersDir, '[postId].ts');
      fs.writeFileSync(
        postFile,
        `export async function GET() { return new Response('Get post'); }`
      );

      await discovery.discover(testDir);

      expect(registry.has('/users/:id/posts/:postId', 'GET')).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it('should handle nested index files', async () => {
      // Create users/index.ts
      const usersDir = path.join(testDir, 'users');
      fs.mkdirSync(usersDir);
      const indexFile = path.join(usersDir, 'index.ts');
      fs.writeFileSync(
        indexFile,
        `export async function GET() { return new Response('Users index'); }`
      );

      await discovery.discover(testDir);

      expect(registry.has('/users', 'GET')).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it('should discover all HTTP method handlers', async () => {
      // Create api.ts with all methods
      const apiFile = path.join(testDir, 'api.ts');
      fs.writeFileSync(
        apiFile,
        `
        export async function GET() { return new Response('GET'); }
        export async function POST() { return new Response('POST'); }
        export async function PUT() { return new Response('PUT'); }
        export async function PATCH() { return new Response('PATCH'); }
        export async function DELETE() { return new Response('DELETE'); }
        export async function OPTIONS() { return new Response('OPTIONS'); }
        export async function HEAD() { return new Response('HEAD'); }
        `
      );

      await discovery.discover(testDir);

      expect(registry.has('/api', 'GET')).toBe(true);
      expect(registry.has('/api', 'POST')).toBe(true);
      expect(registry.has('/api', 'PUT')).toBe(true);
      expect(registry.has('/api', 'PATCH')).toBe(true);
      expect(registry.has('/api', 'DELETE')).toBe(true);
      expect(registry.has('/api', 'OPTIONS')).toBe(true);
      expect(registry.has('/api', 'HEAD')).toBe(true);
      expect(registry.size()).toBe(7);
    });

    it('should ignore test files', async () => {
      // Create users.test.ts
      const testFile = path.join(testDir, 'users.test.ts');
      fs.writeFileSync(
        testFile,
        `export async function GET() { return new Response('Test'); }`
      );

      await discovery.discover(testDir);

      expect(registry.size()).toBe(0);
    });

    it('should ignore spec files', async () => {
      // Create users.spec.ts
      const specFile = path.join(testDir, 'users.spec.ts');
      fs.writeFileSync(
        specFile,
        `export async function GET() { return new Response('Spec'); }`
      );

      await discovery.discover(testDir);

      expect(registry.size()).toBe(0);
    });

    it('should ignore type definition files', async () => {
      // Create types.d.ts
      const dtsFile = path.join(testDir, 'types.d.ts');
      fs.writeFileSync(dtsFile, `export interface User { id: string; }`);

      await discovery.discover(testDir);

      expect(registry.size()).toBe(0);
    });

    it('should ignore non-TypeScript/JavaScript files', async () => {
      // Create README.md
      const readmeFile = path.join(testDir, 'README.md');
      fs.writeFileSync(readmeFile, '# Routes');

      await discovery.discover(testDir);

      expect(registry.size()).toBe(0);
    });

    it('should handle files with no HTTP method exports', async () => {
      // Create utils.ts with no HTTP methods
      const utilsFile = path.join(testDir, 'utils.ts');
      fs.writeFileSync(
        utilsFile,
        `export function helper() { return 'helper'; }`
      );

      // Should not throw, but should warn
      await discovery.discover(testDir);

      expect(registry.size()).toBe(0);
    });

    it('should throw error for invalid route files', async () => {
      // Create a file with syntax error
      const invalidFile = path.join(testDir, 'invalid.ts');
      fs.writeFileSync(invalidFile, `export async function GET() { invalid syntax`);

      await expect(discovery.discover(testDir)).rejects.toThrow(
        'Failed to process route file'
      );
    });

    it('should discover multiple routes from multiple files', async () => {
      // Create multiple route files
      fs.writeFileSync(
        path.join(testDir, 'index.ts'),
        `export async function GET() { return new Response('Home'); }`
      );
      fs.writeFileSync(
        path.join(testDir, 'users.ts'),
        `export async function GET() { return new Response('Users'); }`
      );
      fs.writeFileSync(
        path.join(testDir, 'posts.ts'),
        `export async function GET() { return new Response('Posts'); }`
      );

      await discovery.discover(testDir);

      expect(registry.has('/', 'GET')).toBe(true);
      expect(registry.has('/users', 'GET')).toBe(true);
      expect(registry.has('/posts', 'GET')).toBe(true);
      expect(registry.size()).toBe(3);
    });

    it('should handle complex nested structure', async () => {
      // Create complex structure:
      // /
      // /users
      // /users/:id
      // /users/:id/posts
      // /users/:id/posts/:postId
      // /admin/settings

      fs.writeFileSync(
        path.join(testDir, 'index.ts'),
        `export async function GET() { return new Response('Home'); }`
      );

      const usersDir = path.join(testDir, 'users');
      fs.mkdirSync(usersDir);
      fs.writeFileSync(
        path.join(usersDir, 'index.ts'),
        `export async function GET() { return new Response('Users'); }`
      );
      fs.writeFileSync(
        path.join(usersDir, '[id].ts'),
        `export async function GET() { return new Response('User'); }`
      );

      const postsDir = path.join(usersDir, '[id]', 'posts');
      fs.mkdirSync(postsDir, { recursive: true });
      fs.writeFileSync(
        path.join(postsDir, 'index.ts'),
        `export async function GET() { return new Response('User posts'); }`
      );
      fs.writeFileSync(
        path.join(postsDir, '[postId].ts'),
        `export async function GET() { return new Response('User post'); }`
      );

      const adminDir = path.join(testDir, 'admin');
      fs.mkdirSync(adminDir);
      fs.writeFileSync(
        path.join(adminDir, 'settings.ts'),
        `export async function GET() { return new Response('Settings'); }`
      );

      await discovery.discover(testDir);

      expect(registry.has('/', 'GET')).toBe(true);
      expect(registry.has('/users', 'GET')).toBe(true);
      expect(registry.has('/users/:id', 'GET')).toBe(true);
      expect(registry.has('/users/:id/posts', 'GET')).toBe(true);
      expect(registry.has('/users/:id/posts/:postId', 'GET')).toBe(true);
      expect(registry.has('/admin/settings', 'GET')).toBe(true);
      expect(registry.size()).toBe(6);
    });
  });

  describe('getStats()', () => {
    it('should return statistics about discovered routes', async () => {
      // Create routes with different methods
      fs.writeFileSync(
        path.join(testDir, 'users.ts'),
        `
        export async function GET() { return new Response('List'); }
        export async function POST() { return new Response('Create'); }
        `
      );
      fs.writeFileSync(
        path.join(testDir, 'posts.ts'),
        `
        export async function GET() { return new Response('List'); }
        export async function PUT() { return new Response('Update'); }
        export async function DELETE() { return new Response('Delete'); }
        `
      );

      await discovery.discover(testDir);

      const stats = discovery.getStats();

      expect(stats.totalRoutes).toBe(5);
      expect(stats.routesByMethod.GET).toBe(2);
      expect(stats.routesByMethod.POST).toBe(1);
      expect(stats.routesByMethod.PUT).toBe(1);
      expect(stats.routesByMethod.DELETE).toBe(1);
      expect(stats.routesByMethod.PATCH).toBe(0);
      expect(stats.routesByMethod.OPTIONS).toBe(0);
      expect(stats.routesByMethod.HEAD).toBe(0);
    });

    it('should return zero stats for empty registry', () => {
      const stats = discovery.getStats();

      expect(stats.totalRoutes).toBe(0);
      expect(stats.routesByMethod.GET).toBe(0);
      expect(stats.routesByMethod.POST).toBe(0);
    });
  });

  describe('file path to URL path mapping', () => {
    it('should map index.ts to /', async () => {
      fs.writeFileSync(
        path.join(testDir, 'index.ts'),
        `export async function GET() { return new Response('Home'); }`
      );

      await discovery.discover(testDir);

      expect(registry.has('/', 'GET')).toBe(true);
    });

    it('should map simple file names to paths', async () => {
      fs.writeFileSync(
        path.join(testDir, 'about.ts'),
        `export async function GET() { return new Response('About'); }`
      );

      await discovery.discover(testDir);

      expect(registry.has('/about', 'GET')).toBe(true);
    });

    it('should map [param] to :param', async () => {
      fs.writeFileSync(
        path.join(testDir, '[slug].ts'),
        `export async function GET() { return new Response('Page'); }`
      );

      await discovery.discover(testDir);

      expect(registry.has('/:slug', 'GET')).toBe(true);
    });

    it('should map [...path] to *', async () => {
      fs.writeFileSync(
        path.join(testDir, '[...path].ts'),
        `export async function GET() { return new Response('Catch all'); }`
      );

      await discovery.discover(testDir);

      expect(registry.has('/*', 'GET')).toBe(true);
    });

    it('should handle multiple dynamic segments', async () => {
      const dir = path.join(testDir, '[category]', '[subcategory]');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, '[item].ts'),
        `export async function GET() { return new Response('Item'); }`
      );

      await discovery.discover(testDir);

      expect(registry.has('/:category/:subcategory/:item', 'GET')).toBe(true);
    });

    it('should handle mixed static and dynamic segments', async () => {
      const dir = path.join(testDir, 'api', 'v1', 'users');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, '[id].ts'),
        `export async function GET() { return new Response('User'); }`
      );

      await discovery.discover(testDir);

      expect(registry.has('/api/v1/users/:id', 'GET')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty routes directory', async () => {
      await discovery.discover(testDir);

      expect(registry.size()).toBe(0);
    });

    it('should handle directory with only subdirectories', async () => {
      fs.mkdirSync(path.join(testDir, 'empty1'));
      fs.mkdirSync(path.join(testDir, 'empty2'));

      await discovery.discover(testDir);

      expect(registry.size()).toBe(0);
    });

    it('should handle deeply nested empty directories', async () => {
      fs.mkdirSync(path.join(testDir, 'a', 'b', 'c', 'd'), { recursive: true });

      await discovery.discover(testDir);

      expect(registry.size()).toBe(0);
    });

    it('should handle route files with .js extension', async () => {
      fs.writeFileSync(
        path.join(testDir, 'users.js'),
        `export async function GET() { return new Response('Users'); }`
      );

      await discovery.discover(testDir);

      expect(registry.has('/users', 'GET')).toBe(true);
    });
  });
});
