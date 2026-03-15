/**
 * Migration Create Command
 * 
 * Creates a new migration file
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

export const createCommand = new Command('create')
  .description('Create a new migration file')
  .argument('<name>', 'Migration name (e.g., create_users_table)')
  .option('-d, --dir <directory>', 'Migrations directory', 'src/migrations')
  .action(async (name: string, options: { dir: string }) => {
    try {
      console.log(`Creating migration: ${name}...`);

      // Ensure migrations directory exists
      const migrationsDir = path.resolve(process.cwd(), options.dir);
      if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
        console.log(`Created migrations directory: ${options.dir}`);
      }

      // Generate timestamp
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
      const fileName = `${timestamp}_${name}.ts`;
      const filePath = path.join(migrationsDir, fileName);

      // Check if file already exists
      if (fs.existsSync(filePath)) {
        console.error(`Error: Migration file already exists: ${fileName}`);
        process.exit(1);
      }

      // Generate migration template
      const template = generateMigrationTemplate(name);

      // Write migration file
      fs.writeFileSync(filePath, template, 'utf-8');

      console.log(`✓ Created migration: ${fileName}`);
      console.log(`  Location: ${path.relative(process.cwd(), filePath)}`);
      console.log('');
      console.log('Next steps:');
      console.log('  1. Edit the migration file to add your schema changes');
      console.log('  2. Run "webloom migrate up" to apply the migration');
    } catch (error) {
      console.error('Error creating migration:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Generate migration template
 */
function generateMigrationTemplate(name: string): string {
  const className = name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  return `/**
 * Migration: ${name}
 * 
 * Generated at: ${new Date().toISOString()}
 */

import type { DatabaseAdapter } from '@web-loom/api-core';

export class ${className} {
  /**
   * Run the migration (apply changes)
   */
  async up(db: DatabaseAdapter): Promise<void> {
    // TODO: Implement migration up logic
    // Example:
    // await db.execute(\`
    //   CREATE TABLE users (
    //     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    //     email VARCHAR(255) NOT NULL UNIQUE,
    //     name VARCHAR(255) NOT NULL,
    //     created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    //     updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    //   )
    // \`);
    
    throw new Error('Migration up() not implemented');
  }

  /**
   * Reverse the migration (rollback changes)
   */
  async down(db: DatabaseAdapter): Promise<void> {
    // TODO: Implement migration down logic
    // Example:
    // await db.execute('DROP TABLE IF EXISTS users');
    
    throw new Error('Migration down() not implemented');
  }
}
`;
}
