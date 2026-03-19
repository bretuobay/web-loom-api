/**
 * Migration Down Command
 *
 * Reverts the last applied migration
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

export const downCommand = new Command('down')
  .description('Revert the last applied migration')
  .option('-d, --dir <directory>', 'Migrations directory', 'src/migrations')
  .option('-s, --steps <number>', 'Number of migrations to revert', '1')
  .action(async (options: { dir: string; steps: string }) => {
    try {
      console.log('Reverting migrations...');
      console.log('');

      const migrationsDir = path.resolve(process.cwd(), options.dir);

      // Check if migrations directory exists
      if (!fs.existsSync(migrationsDir)) {
        console.log('No migrations directory found.');
        return;
      }

      // Load applied migrations
      const appliedMigrations = loadAppliedMigrations(migrationsDir);

      if (appliedMigrations.length === 0) {
        console.log('No migrations to revert. Database is empty.');
        return;
      }

      // Determine how many migrations to revert
      const stepsToRevert = parseInt(options.steps, 10);
      const migrationsToRevert = appliedMigrations.slice(-stepsToRevert).reverse();

      console.log(`Found ${appliedMigrations.length} applied migration(s)`);
      console.log(`Reverting ${migrationsToRevert.length} migration(s):`);
      migrationsToRevert.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file}`);
      });
      console.log('');

      // Revert migrations
      for (const file of migrationsToRevert) {
        const filePath = path.join(migrationsDir, file);

        try {
          console.log(`→ Reverting: ${file}`);

          // Check if migration file still exists
          if (!fs.existsSync(filePath)) {
            console.warn(`  ⚠ Warning: Migration file not found: ${file}`);
            console.warn(`    Removing from tracking anyway...`);
          } else {
            // Validate the file has down() method
            const content = fs.readFileSync(filePath, 'utf-8');

            if (!content.includes('async down(')) {
              throw new Error('Migration file must have a down() method');
            }

            // In a real implementation:
            // 1. Import the migration class
            // 2. Create an instance
            // 3. Call the down() method with database connection
            // 4. Remove the migration from the migrations table
          }

          // Remove from applied migrations
          const index = appliedMigrations.indexOf(file);
          if (index > -1) {
            appliedMigrations.splice(index, 1);
          }
          saveAppliedMigrations(migrationsDir, appliedMigrations);

          console.log(`  ✓ Reverted: ${file}`);
        } catch (error) {
          console.error(`  ✗ Failed: ${file}`);
          console.error(`    Error: ${error instanceof Error ? error.message : error}`);
          console.log('');
          console.log('Migration rollback failed.');
          process.exit(1);
        }
      }

      console.log('');
      console.log(`✓ Successfully reverted ${migrationsToRevert.length} migration(s)`);
      console.log('');
      console.log('Note: This is a simulation. In production, migrations would be');
      console.log('executed against your database with proper transaction handling.');
    } catch (error) {
      console.error('Error reverting migrations:', error instanceof Error ? error.message : error);
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
 * Save applied migrations to tracking file
 */
function saveAppliedMigrations(migrationsDir: string, applied: string[]): void {
  const trackingFile = path.join(migrationsDir, '.migrations.json');
  const data = {
    applied,
    lastUpdated: new Date().toISOString(),
  };

  fs.writeFileSync(trackingFile, JSON.stringify(data, null, 2), 'utf-8');
}
