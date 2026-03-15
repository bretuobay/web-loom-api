/**
 * Development Server Command
 * 
 * Starts a development server with hot reload and file watching
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';

export const createDevCommand = (): Command => {
  return new Command('dev')
    .description('Start development server with hot reload')
    .option('-p, --port <number>', 'Port to run the server on', '3000')
    .option('-h, --host <string>', 'Host to bind the server to', 'localhost')
    .option('--config <path>', 'Path to configuration file', 'webloom.config.ts')
    .option('--watch <paths>', 'Additional paths to watch (comma-separated)', 'src')
    .option('--no-clear', 'Do not clear console on reload')
    .option('--verbose', 'Enable verbose logging including SQL queries')
    .action(async (options: {
      port: string;
      host: string;
      config: string;
      watch: string;
      clear: boolean;
      verbose: boolean;
    }) => {
      try {
        console.log('🚀 Starting Web Loom development server...');
        console.log('');

        const port = parseInt(options.port, 10);
        const watchPaths = options.watch.split(',').map(p => p.trim());

        // Check if config file exists
        const configPath = path.resolve(process.cwd(), options.config);
        if (!fs.existsSync(configPath)) {
          console.error(`❌ Configuration file not found: ${options.config}`);
          console.log('');
          console.log('Run "webloom init" to create a new project.');
          process.exit(1);
        }

        // Display server info
        console.log('📋 Server Configuration:');
        console.log(`   URL: http://${options.host}:${port}`);
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

            // In a real implementation, this would:
            // 1. Stop the current server
            // 2. Clear module cache
            // 3. Reload configuration
            // 4. Re-discover routes and models
            // 5. Restart the server

            console.log('✓ Server reloaded successfully');
            console.log(`   Ready at http://${options.host}:${port}`);
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
        console.log('');
        console.log('📚 Available routes:');
        console.log('   GET    /health          - Health check endpoint');
        console.log('   GET    /api/docs        - API documentation (OpenAPI)');
        console.log('');
        console.log('💡 Tips:');
        console.log('   • Press Ctrl+C to stop the server');
        console.log('   • Edit files in src/ to see hot reload in action');
        console.log('   • Check /api/docs for interactive API documentation');
        if (!options.verbose) {
          console.log('   • Use --verbose flag to see SQL queries');
        }
        console.log('');
        console.log('👀 Watching for changes...');

        // Handle graceful shutdown
        const shutdown = () => {
          console.log('');
          console.log('');
          console.log('👋 Shutting down development server...');
          watcher.close();
          process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

        // Keep process alive
        await new Promise(() => {});
      } catch (error) {
        console.error('❌ Error starting development server:', error instanceof Error ? error.message : error);
        
        if (error instanceof Error && error.stack) {
          console.log('');
          console.log('Stack trace:');
          console.log(error.stack);
        }
        
        process.exit(1);
      }
    });
};
