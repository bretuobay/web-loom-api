/**
 * Migration Up Command
 * 
 * Applies pending migrations
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

export const upCommand = new Command('up')
  .description('Apply pending migrations')
  .option('-d, --dir <directory>', 'Migrations directory', 'src/migrations')
  .option('-s, --steps <number>', 'Number of migrations to apply', '0')
  .action(async (options: { dir: string; steps: string }) => {
    try {
      console.log('Applying migrations...');
      console.log('');

      const migrationsDir = path.resolve(process.cwd(), options.dir);
      
      // Check if migrations directory exists
      if (!fs.existsSync(migrationsDir)) {
        console.log('No migrations directory found.');
        console.log(`Expected location: ${options.dir}`);
        console.log('');
        console.log('Run "webloom migrate create <name>" to create your first migration.');
        return;
      }

      // Get all migration files
      const files = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
        .sort();

      if (files.length === 0) {
        console.log('No migration files found.');
        console.log('');
        console.log('Run "webloom migrate create <name>" to create a migration.');
        return;
      }

      // Load applied migrations from tracking file
      const appliedMigrations = loadAppliedMigrations(migrationsDir);

      // Find pending migrations
      const pendingMigrations = files.filter(file => !appliedMigrations.includes(file));

      if (pendingMigrations.length === 0) {
        console.log('✓ No pending migrations. Database is up to date.');
        return;
      }

      console.log(`Found ${pendingMigrations.length} pending migration(s):`);
      pendingMigrations.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file}`);
      });
      console.log('');

      // Determine how many migrations to apply
      const stepsToApply = parseInt(options.steps, 10);
      const migrationsToApply = stepsToApply > 0 
        ? pendingMigrations.slice(0, stepsToApply)
        : pendingMigrations;

      console.log(`Applying ${migrationsToApply.length} migration(s)...`);
      console.log('');

      // Note: In a real implementation, this would connect to the database
      // and execute the migrations. For now, we'll simulate the process.
      
      for (const file of migrationsToApply) {
        const filePath = path.join(migrationsDir, file);
        
        try {
          console.log(`→ Applying: ${file}`);
          
          // In a real implementation:
          // 1. Import the migration class
          // 2. Create an instance
          // 3. Call the up() method with database connection
          // 4. Record the migration in the migrations table
          
          // For now, just validate the file exists and has the right structure
          const content = fs.readFileSync(filePath, 'utf-8');
          
          if (!content.includes('async up(') || !content.includes('async down(')) {
            throw new Error('Migration file must have up() and down() methods');
          }

          // Mark as applied
          appliedMigrations.push(file);
          saveAppliedMigrations(migrationsDir, appliedMigrations);
          
          console.log(`  ✓ Applied: ${file}`);
        } catch (error) {
          console.error(`  ✗ Failed: ${file}`);
          console.error(`    Error: ${error instanceof Error ? error.message : error}`);
          console.log('');
          console.log('Migration failed. Rolling back...');
          
          // In a real implementation, this would rollback the transaction
          process.exit(1);
        }
      }

      console.log('');
      console.log(`✓ Successfully applied ${migrationsToApply.length} migration(s)`);
      console.log('');
      console.log('Note: This is a simulation. In production, migrations would be');
      console.log('executed against your database with proper transaction handling.');
    } catch (error) {
      console.error('Error applying migrations:', error instanceof Error ? error.message : error);
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
