/**
 * Migration Runner
 *
 * Executes migration files with transaction support.
 * Uses the `MigrationDB` interface from migration-tracker, which is
 * compatible with any Drizzle driver that exposes raw query execution.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { MigrationDB, MigrationRecord } from './migration-tracker';
import { MigrationTracker } from './migration-tracker';

export interface Migration {
  name: string;
  filePath: string;
  up: (db: MigrationDB) => Promise<void>;
  down: (db: MigrationDB) => Promise<void>;
}

export class MigrationRunner {
  private db: MigrationDB;
  private tracker: MigrationTracker;
  private migrationsDir: string;

  constructor(db: MigrationDB, migrationsDir: string) {
    this.db = db;
    this.tracker = new MigrationTracker(db);
    this.migrationsDir = migrationsDir;
  }

  async initialize(): Promise<void> {
    await this.tracker.ensureTable();
  }

  async getMigrationFiles(): Promise<string[]> {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }
    return fs
      .readdirSync(this.migrationsDir)
      .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
      .filter((file) => !file.startsWith('.'))
      .sort();
  }

  async getPendingMigrations(): Promise<string[]> {
    const allFiles = await this.getMigrationFiles();
    const applied = await this.tracker.getAppliedMigrations();
    const appliedNames = new Set(applied.map((m) => m.name));
    return allFiles.filter((file) => !appliedNames.has(file));
  }

  async loadMigration(fileName: string): Promise<Migration> {
    const filePath = path.join(this.migrationsDir, fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Migration file not found: ${fileName}`);
    }

    const migration: Migration = {
      name: fileName,
      filePath,
      up: async (_db: MigrationDB) => {
        throw new Error('Migration loading not implemented in simulation mode');
      },
      down: async (_db: MigrationDB) => {
        throw new Error('Migration loading not implemented in simulation mode');
      },
    };

    return migration;
  }

  async runPending(limit?: number): Promise<string[]> {
    await this.initialize();

    const pending = await this.getPendingMigrations();
    const toRun = limit ? pending.slice(0, limit) : pending;

    if (toRun.length === 0) return [];

    const batch = (await this.tracker.getLatestBatch()) + 1;
    const applied: string[] = [];

    for (const fileName of toRun) {
      try {
        await this.runMigration(fileName, batch);
        applied.push(fileName);
      } catch (error) {
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

  private async runMigration(fileName: string, batch: number): Promise<void> {
    const migration = await this.loadMigration(fileName);

    await this.db.transaction(async (trx) => {
      await migration.up(trx as MigrationDB);
      await this.tracker.recordMigration(fileName, batch);
    });
  }

  async rollbackLastBatch(): Promise<string[]> {
    await this.initialize();

    const latestBatch = await this.tracker.getLatestBatch();
    if (latestBatch === 0) return [];

    const migrations = await this.tracker.getMigrationsByBatch(latestBatch);
    const rolledBack: string[] = [];

    for (const migration of migrations) {
      try {
        await this.rollbackMigration(migration.name);
        rolledBack.push(migration.name);
      } catch (error) {
        throw new Error(
          `Failed to rollback ${migration.name}: ${error instanceof Error ? error.message : error}`
        );
      }
    }

    return rolledBack;
  }

  async rollbackMigrations(count: number): Promise<string[]> {
    await this.initialize();

    const migrations = await this.tracker.getLastMigrations(count);
    const rolledBack: string[] = [];

    for (const migration of migrations) {
      try {
        await this.rollbackMigration(migration.name);
        rolledBack.push(migration.name);
      } catch (error) {
        throw new Error(
          `Failed to rollback ${migration.name}: ${error instanceof Error ? error.message : error}`
        );
      }
    }

    return rolledBack;
  }

  private async rollbackMigration(fileName: string): Promise<void> {
    const migration = await this.loadMigration(fileName);

    await this.db.transaction(async (trx) => {
      await migration.down(trx as MigrationDB);
      await this.tracker.removeMigration(fileName);
    });
  }

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
    const appliedMap = new Map<string, MigrationRecord>(
      appliedMigrations.map((m) => [m.name, m])
    );

    const migrations = allFiles.map((file) => {
      const applied = appliedMap.get(file);
      return {
        name: file,
        status: applied ? ('applied' as const) : ('pending' as const),
        ...(applied?.appliedAt !== undefined && { appliedAt: applied.appliedAt }),
        ...(applied?.batch !== undefined && { batch: applied.batch }),
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
