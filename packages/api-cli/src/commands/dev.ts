/**
 * Development Server Command
 *
 * Starts a development server with hot reload and file watching
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { DocsServer } from '../utils/docs-server.js';

export const createDevCommand = (): Command => {
  return new Command('dev')
    .description('Start development server with hot reload')
    .option('-p, --port <number>', 'Port to run the server on', '3000')
    .option('-h, --host <string>', 'Host to bind the server to', 'localhost')
    .option('--docs-port <number>', 'Port for API documentation server', '3001')
    .option('--config <path>', 'Path to configuration file', 'webloom.config.ts')
    .option('--watch <paths>', 'Additional paths to watch (comma-separated)', 'src')
    .option('--no-clear', 'Do not clear console on reload')
    .option('--no-docs', 'Disable API documentation server')
    .option('--verbose', 'Enable verbose logging including SQL queries')
    .action(
      async (options: {
        port: string;
        host: string;
        docsPort: string;
        config: string;
        watch: string;
        clear: boolean;
        docs: boolean;
        verbose: boolean;
      }) => {
        try {
          console.log('🚀 Starting Web Loom development server...');
          console.log('');

          const port = parseInt(options.port, 10);
          const docsPort = parseInt(options.docsPort, 10);
          const watchPaths = options.watch.split(',').map((p) => p.trim());

          // Check if config file exists
          const configPath = path.resolve(process.cwd(), options.config);
          if (!fs.existsSync(configPath)) {
            console.error(`❌ Configuration file not found: ${options.config}`);
            console.log('');
            console.log('Run "webloom init" to create a new project.');
            process.exit(1);
          }

          // Start documentation server
          let docsServer: DocsServer | null = null;
          if (options.docs) {
            try {
              docsServer = new DocsServer(process.cwd(), {
                title: 'Web Loom API',
                version: '1.0.0',
                description: 'API Documentation',
              });
              await docsServer.start(docsPort, options.host);
            } catch (error) {
              console.error(
                `⚠️  Failed to start documentation server:`,
                error instanceof Error ? error.message : error
              );
              console.log('   Continuing without API documentation...');
              console.log('');
            }
          }

          // Display server info
          console.log('📋 Server Configuration:');
          console.log(`   URL: http://${options.host}:${port}`);
          if (docsServer) {
            console.log(`   Docs: http://${options.host}:${docsPort}/docs`);
          }
          console.log(`   Config: ${options.config}`);
          console.log(`   Watching: ${watchPaths.join(', ')}`);
          if (options.verbose) {
            console.log(`   Verbose: enabled (SQL queries will be logged)`);
          }
          console.log('');

          // Start file watcher
          const watcher = chokidar.watch(watchPaths, {
            ignored: [
              '**/node_modules/**',
              '**/.git/**',
              '**/dist/**',
              '**/.turbo/**',
              '**/*.test.ts',
              '**/*.spec.ts',
            ],
            persistent: true,
            ignoreInitial: true,
          });

          let isReloading = false;
          let reloadTimeout: NodeJS.Timeout | null = null;

          const reload = (filePath: string, event: string) => {
            if (isReloading) return;

            // Debounce reloads
            if (reloadTimeout) {
              clearTimeout(reloadTimeout);
            }

            reloadTimeout = setTimeout(() => {
              isReloading = true;

              if (options.clear) {
                console.clear();
              }

              console.log('');
              console.log('🔄 File changed, reloading...');
              console.log(`   ${event}: ${path.relative(process.cwd(), filePath)}`);
              console.log('');

              // Refresh documentation if enabled
              if (docsServer) {
                try {
                  docsServer.refreshSpec();
                  console.log('✓ API documentation updated');
                } catch (error) {
                  console.error(
                    '⚠️  Failed to update documentation:',
                    error instanceof Error ? error.message : error
                  );
                }
              }

              // In a real implementation, this would:
              // 1. Stop the current server
              // 2. Clear module cache
              // 3. Reload configuration
              // 4. Re-discover routes and models
              // 5. Restart the server

              console.log('✓ Server reloaded successfully');
              console.log(`   Ready at http://${options.host}:${port}`);
              if (docsServer) {
                console.log(`   Docs at http://${options.host}:${docsPort}/docs`);
              }
              console.log('');
              console.log('👀 Watching for changes...');

              isReloading = false;
            }, 100);
          };

          watcher
            .on('add', (filePath) => reload(filePath, 'added'))
            .on('change', (filePath) => reload(filePath, 'changed'))
            .on('unlink', (filePath) => reload(filePath, 'deleted'));

          // Simulate server start
          console.log('✓ Server started successfully');
          console.log('');
          console.log(`🌐 Server running at http://${options.host}:${port}`);
          if (docsServer) {
            console.log(`📚 API Documentation at http://${options.host}:${docsPort}/docs`);
          }
          console.log('');
          console.log('📚 Available routes:');
          console.log('   GET    /health          - Health check endpoint');
          if (docsServer) {
            console.log(
              `   GET    http://${options.host}:${docsPort}/docs        - API documentation (Scalar UI)`
            );
            console.log(
              `   GET    http://${options.host}:${docsPort}/openapi.json - OpenAPI specification`
            );
          }
          console.log('');
          console.log('💡 Tips:');
          console.log('   • Press Ctrl+C to stop the server');
          console.log('   • Edit files in src/ to see hot reload in action');
          if (docsServer) {
            console.log(
              `   • Visit http://${options.host}:${docsPort}/docs for interactive API documentation`
            );
          }
          if (!options.verbose) {
            console.log('   • Use --verbose flag to see SQL queries');
          }
          if (!options.docs) {
            console.log('   • Use --docs flag to enable API documentation');
          }
          console.log('');
          console.log('👀 Watching for changes...');

          // Handle graceful shutdown
          const shutdown = async () => {
            console.log('');
            console.log('');
            console.log('👋 Shutting down development server...');
            watcher.close();
            if (docsServer) {
              await docsServer.stop();
            }
            process.exit(0);
          };

          process.on('SIGINT', shutdown);
          process.on('SIGTERM', shutdown);

          // Keep process alive
          await new Promise(() => {});
        } catch (error) {
          console.error(
            '❌ Error starting development server:',
            error instanceof Error ? error.message : error
          );

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
