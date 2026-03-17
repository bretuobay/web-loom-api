/**
 * Generate Client Command
 *
 * Generates TypeScript API client from project routes and models
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore - module may not be installed
import { ClientGenerator } from '@web-loom/api-generator-client';
// @ts-ignore - module may not be installed
import type { ModelDefinition, RouteDefinition } from '@web-loom/api-generator-client';

const HTTP_METHODS: RouteDefinition['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Discover routes from src/routes directory
 */
function discoverRoutes(projectRoot: string): RouteDefinition[] {
  const routes: RouteDefinition[] = [];
  const routesDir = path.join(projectRoot, 'src', 'routes');

  if (!fs.existsSync(routesDir)) {
    return routes;
  }

  const scanDirectory = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(routesDir, fullPath);

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        let urlPath = relativePath
          .replace(/\.(ts|js)$/, '')
          .replace(/\\/g, '/')
          .replace(/\[([^\]]+)\]/g, ':$1')
          .replace(/index$/, '');

        if (!urlPath.startsWith('/')) {
          urlPath = `/${urlPath}`;
        }

        if (urlPath !== '/' && urlPath.endsWith('/')) {
          urlPath = urlPath.slice(0, -1);
        }

        const primaryTag = urlPath.split('/')[1] || 'default';
        for (const method of HTTP_METHODS) {
          routes.push({
            path: urlPath,
            method,
            metadata: {
              description: `${method} ${urlPath}`,
              tags: [primaryTag],
            },
          });
        }
      }
    }
  };

  scanDirectory(routesDir);
  return routes;
}

/**
 * Discover models from src/models directory
 */
function discoverModels(projectRoot: string): ModelDefinition[] {
  const models: ModelDefinition[] = [];
  const modelsDir = path.join(projectRoot, 'src', 'models');

  if (!fs.existsSync(modelsDir)) {
    return models;
  }

  return models;
}

export const createGenerateClientCommand = (): Command => {
  return new Command('client')
    .description('Generate TypeScript API client')
    .option('-o, --output <path>', 'Output directory path', 'src/generated/client')
    .option('--base-url <url>', 'Base URL for API requests', '')
    .option('--class-name <name>', 'Client class name', 'APIClient')
    .option('--no-hooks', 'Disable React hooks generation')
    .option('--no-errors', 'Disable error classes generation')
    .option('--no-interceptors', 'Disable interceptors support')
    .option('--no-retry', 'Disable retry logic')
    .option('--format <format>', 'Export format (esm or cjs)', 'esm')
    .action(
      async (options: {
        output: string;
        baseUrl: string;
        className: string;
        hooks: boolean;
        errors: boolean;
        interceptors: boolean;
        retry: boolean;
        format: string;
      }) => {
        try {
          console.log('?? Generating TypeScript API client...');
          console.log('');

          if (options.format !== 'esm' && options.format !== 'cjs') {
            console.error('? Invalid format. Must be "esm" or "cjs"');
            process.exit(1);
          }

          const projectRoot = process.cwd();
          const routes = discoverRoutes(projectRoot);
          const models = discoverModels(projectRoot);

          console.log(`?? Discovered ${routes.length} routes and ${models.length} models`);
          console.log('');

          const generator = new ClientGenerator({
            className: options.className,
            baseUrl: options.baseUrl,
            generateReactHooks: options.hooks,
            generateErrors: options.errors,
            includeInterceptors: options.interceptors,
            includeRetry: options.retry,
            exportFormat: options.format,
          });

          generator.registerRoutes(routes);
          generator.registerModels(models);

          const generated = generator.generate();

          let outputPath = options.output;
          if (!path.isAbsolute(outputPath)) {
            outputPath = path.join(projectRoot, outputPath);
          }

          if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
          }

          const files: Array<{ name: string; content: string }> = [
            { name: 'types.ts', content: generated.types },
            { name: 'client.ts', content: generated.client },
            { name: 'utils.ts', content: generated.utils ?? '' },
          ];

          if (generated.errors !== undefined) {
            files.push({ name: 'errors.ts', content: generated.errors });
          }

          if (generated.hooks !== undefined) {
            files.push({ name: 'hooks.ts', content: generated.hooks });
          }

          const indexLines: string[] = [
            '/**',
            ' * Generated API Client',
            ' * ',
            ' * DO NOT EDIT - This file is auto-generated',
            ' */',
            '',
            "export * from './types';",
            "export * from './client';",
            "export * from './utils';",
          ];

          if (generated.errors !== undefined) {
            indexLines.push("export * from './errors';");
          }

          if (generated.hooks !== undefined) {
            indexLines.push("export * from './hooks';");
          }

          files.push({ name: 'index.ts', content: `${indexLines.join('\n')}\n` });

          for (const file of files) {
            const filePath = path.join(outputPath, file.name);
            fs.writeFileSync(filePath, file.content, 'utf-8');
          }

          console.log('? TypeScript API client generated successfully');
          console.log('');
          console.log(`?? Output directory: ${path.relative(projectRoot, outputPath)}`);
          console.log(`?? Files generated: ${files.length}`);
          console.log('');
          console.log('Generated files:');
          for (const file of files) {
            console.log(`   • ${file.name}`);
          }
          console.log('');
          console.log('?? Tips:');
          console.log('   • Import the client: import { APIClient } from "./generated/client"');
          console.log('   • Initialize: const client = new APIClient({ baseUrl: "https://api.example.com" })');
          if (options.hooks) {
            console.log('   • Use React hooks: import { useGetUsers } from "./generated/client"');
          }
          console.log('   • Customize with --base-url, --class-name, and other options');
        } catch (error) {
          console.error('? Error generating TypeScript client:', error instanceof Error ? error.message : error);

          if (error instanceof Error && error.stack) {
            console.log('');
            console.log('Stack trace:');
            console.log(error.stack);
          }

          process.exit(1);
        }
      }
    );
};
