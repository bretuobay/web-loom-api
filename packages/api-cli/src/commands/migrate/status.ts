/**
 * Migration Status Command
 *
 * Shows the status of all migrations
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

export const statusCommand = new Command('status')
  .description('Show migration status')
  .option('-d, --dir <directory>', 'Migrations directory', 'src/migrations')
  .action(async (options: { dir: string }) => {
    try {
      const migrationsDir = path.resolve(process.cwd(), options.dir);

      console.log('Migration Status');
      console.log('================');
      console.log('');

      // Check if migrations directory exists
      if (!fs.existsSync(migrationsDir)) {
        console.log('No migrations directory found.');
        console.log(`Expected location: ${options.dir}`);
        console.log('');
        console.log('Run "webloom migrate create <name>" to create your first migration.');
        return;
      }

      // Get all migration files
      const files = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
        .filter((file) => file !== '.migrations.json')
        .sort();

      if (files.length === 0) {
        console.log('No migration files found.');
        console.log('');
        console.log('Run "webloom migrate create <name>" to create a migration.');
        return;
      }

      // Load applied migrations
      const appliedMigrations = loadAppliedMigrations(migrationsDir);
      const appliedSet = new Set(appliedMigrations);

      // Display migrations
      console.log(`Total migrations: ${files.length}`);
      console.log(`Applied: ${appliedMigrations.length}`);
      console.log(`Pending: ${files.length - appliedMigrations.length}`);
      console.log('');

      console.log('Migrations:');
      console.log('-----------');

      files.forEach((file, _index) => {
        const isApplied = appliedSet.has(file);
        const status = isApplied ? '✓ Applied' : '○ Pending';
        const statusColor = isApplied ? '\x1b[32m' : '\x1b[33m'; // Green or Yellow
        const resetColor = '\x1b[0m';

        console.log(`${statusColor}${status}${resetColor}  ${file}`);

        // Show when it was applied
        if (isApplied) {
          const appliedIndex = appliedMigrations.indexOf(file);
          const appliedDate = getAppliedDate(migrationsDir, file);
          if (appliedDate) {
            console.log(`           Applied: ${appliedDate}`);
          } else {
            console.log(`           Applied: (order ${appliedIndex + 1})`);
          }
        }
      });

      console.log('');

      // Show next steps
      const pendingCount = files.length - appliedMigrations.length;
      if (pendingCount > 0) {
        console.log('Next steps:');
        console.log(`  Run "webloom migrate up" to apply ${pendingCount} pending migration(s)`);
      } else {
        console.log('✓ Database is up to date');
      }

      console.log('');
      console.log('Note: This is a simulation using a local tracking file.');
      console.log('In production, migration status would be tracked in your database.');
    } catch (error) {
      console.error(
        'Error checking migration status:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

/**
 * Load applied migrations from tracking file
 */
function loadAppliedMigrations(migrationsDir: string): string[] {
  const trackingFile = path.join(migrationsDir, '.migrations.json');

  if (!fs.existsSync(trackingFile)) {
    return [];
  }

  try {
    const content = fs.readFileSync(trackingFile, 'utf-8');
    const data = JSON.parse(content);
    return data.applied || [];
  } catch {
    return [];
  }
}

/**
 * Get the date when a migration was applied
 */
function getAppliedDate(migrationsDir: string, _fileName: string): string | null {
  const trackingFile = path.join(migrationsDir, '.migrations.json');

  if (!fs.existsSync(trackingFile)) {
    return null;
  }

  try {
    const content = fs.readFileSync(trackingFile, 'utf-8');
    const data = JSON.parse(content);

    // For now, just return the last updated date
    // In a real implementation, each migration would have its own timestamp
    return data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : null;
  } catch {
    return null;
  }
}
