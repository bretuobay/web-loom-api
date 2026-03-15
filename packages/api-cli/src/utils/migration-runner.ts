/**
 * Migration Runner
 * 
 * Executes migration files with transaction support
 */

import type { DatabaseAdapter } from '@web-loom/api-core';
import * as fs from 'fs';
import * as path from 'path';
import { MigrationTracker } from './migration-tracker';

export interface Migration {
  name: string;
  filePath: string;
  up: (db: DatabaseAdapter) => Promise<void>;
  down: (db: DatabaseAdapter) => Promise<void>;
}

export class MigrationRunner {
  private db: DatabaseAdapter;
  private tracker: MigrationTracker;
  private migrationsDir: string;

  constructor(db: DatabaseAdapter, migrationsDir: string) {
    this.db = db;
    this.tracker = new MigrationTracker(db);
    this.migrationsDir = migrationsDir;
  }

  /**
   * Initialize migration system
   */
  async initialize(): Promise<void> {
    await this.tracker.ensureTable();
  }

  /**
   * Get all migration files
   */
  async getMigrationFiles(): Promise<string[]> {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }

    return fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .filter(file => !file.startsWith('.'))
      .sort();
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<string[]> {
    const allFiles = await this.getMigrationFiles();
    const applied = await this.tracker.getAppliedMigrations();
    const appliedNames = new Set(applied.map(m => m.name));

    return allFiles.filter(file => !appliedNames.has(file));
  }

  /**
   * Load a migration file
   */
  async loadMigration(fileName: string): Promise<Migration> {
    const filePath = path.join(this.migrationsDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Migration file not found: ${fileName}`);
    }

    try {
      // In a real implementation, this would dynamically import the migration
      // For now, we'll return a mock migration
      const migration: Migration = {
        name: fileName,
        filePath,
        up: async (db: DatabaseAdapter) => {
          // This would be the actual migration's up() method
          throw new Error('Migration loading not implemented in simulation mode');
        },
        down: async (db: DatabaseAdapter) => {
          // This would be the actual migration's down() method
          throw new Error('Migration loading not implemented in simulation mode');
        },
      };

      return migration;
    } catch (error) {
      throw new Error(`Failed to load migration ${fileName}: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Run pending migrations
   */
  async runPending(limit?: number): Promise<string[]> {
    await this.initialize();

    const pending = await this.getPendingMigrations();
    const toRun = limit ? pending.slice(0, limit) : pending;

    if (toRun.length === 0) {
      return [];
    }

    const batch = await this.tracker.getLatestBatch() + 1;
    const applied: string[] = [];

    for (const fileName of toRun) {
      try {
        await this.runMigration(fileName, batch);
        applied.push(fileName);
      } catch (error) {
        // Rollback all migrations in this batch
        for (const appliedFile of applied) {
          try {
            await this.rollbackMigration(appliedFile);
          } catch (rollbackError) {
            console.error(`Failed to rollback ${appliedFile}:`, rollbackError);
          }
        }
        throw error;
      }
    }

    return applied;
  }

  /**
   * Run a single migration
   */
  private async runMigration(fileName: string, batch: number): Promise<void> {
    const migration = await this.loadMigration(fileName);

    // Start transaction
    await this.db.transaction(async (trx) => {
      // Run migration
      await migration.up(trx);
      
      // Record migration
      await this.tracker.recordMigration(fileName, batch);
    });
  }

  /**
   * Rollback last batch
   */
  async rollbackLastBatch(): Promise<string[]> {
    await this.initialize();

    const latestBatch = await this.tracker.getLatestBatch();
    
    if (latestBatch === 0) {
      return [];
    }

    const migrations = await this.tracker.getMigrationsByBatch(latestBatch);
    const rolledBack: string[] = [];

    for (const migration of migrations) {
      try {
        await this.rollbackMigration(migration.name);
        rolledBack.push(migration.name);
      } catch (error) {
        throw new Error(`Failed to rollback ${migration.name}: ${error instanceof Error ? error.message : error}`);
      }
    }

    return rolledBack;
  }

  /**
   * Rollback specific number of migrations
   */
  async rollbackMigrations(count: number): Promise<string[]> {
    await this.initialize();

    const migrations = await this.tracker.getLastMigrations(count);
    const rolledBack: string[] = [];

    for (const migration of migrations) {
      try {
        await this.rollbackMigration(migration.name);
        rolledBack.push(migration.name);
      } catch (error) {
        throw new Error(`Failed to rollback ${migration.name}: ${error instanceof Error ? error.message : error}`);
      }
    }

    return rolledBack;
  }

  /**
   * Rollback a single migration
   */
  private async rollbackMigration(fileName: string): Promise<void> {
    const migration = await this.loadMigration(fileName);

    // Start transaction
    await this.db.transaction(async (trx) => {
      // Run migration down
      await migration.down(trx);
      
      // Remove migration record
      await this.tracker.removeMigration(fileName);
    });
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    total: number;
    applied: number;
    pending: number;
    migrations: Array<{
      name: string;
      status: 'applied' | 'pending';
      appliedAt?: Date;
      batch?: number;
    }>;
  }> {
    await this.initialize();

    const allFiles = await this.getMigrationFiles();
    const appliedMigrations = await this.tracker.getAppliedMigrations();
    const appliedMap = new Map(appliedMigrations.map(m => [m.name, m]));

    const migrations = allFiles.map(file => {
      const applied = appliedMap.get(file);
      return {
        name: file,
        status: applied ? 'applied' as const : 'pending' as const,
        appliedAt: applied?.appliedAt,
        batch: applied?.batch,
      };
    });

    return {
      total: allFiles.length,
      applied: appliedMigrations.length,
      pending: allFiles.length - appliedMigrations.length,
      migrations,
    };
  }
}
