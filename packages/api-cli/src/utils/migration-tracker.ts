/**
 * Migration Tracker
 * 
 * Handles tracking of applied migrations in the database
 */

import type { DatabaseAdapter } from '@web-loom/api-core';

export interface MigrationRecord {
  id: number;
  name: string;
  appliedAt: Date;
  batch: number;
}

export class MigrationTracker {
  private db: DatabaseAdapter;
  private tableName: string;

  constructor(db: DatabaseAdapter, tableName = 'migrations') {
    this.db = db;
    this.tableName = tableName;
  }

  /**
   * Ensure migrations table exists
   */
  async ensureTable(): Promise<void> {
    const tableExists = await this.checkTableExists();
    
    if (!tableExists) {
      await this.createTable();
    }
  }

  /**
   * Check if migrations table exists
   */
  private async checkTableExists(): Promise<boolean> {
    try {
      // Try to query the table
      await this.db.query(
        `SELECT 1 FROM ${this.tableName} LIMIT 1`
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create migrations table
   */
  private async createTable(): Promise<void> {
    await this.db.execute(`
      CREATE TABLE ${this.tableName} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
        batch INTEGER NOT NULL
      )
    `);
  }

  /**
   * Get all applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.db.query<{
      id: number;
      name: string;
      applied_at: Date;
      batch: number;
    }>(
      `SELECT id, name, applied_at, batch FROM ${this.tableName} ORDER BY id ASC`
    );

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      appliedAt: new Date(row.applied_at),
      batch: row.batch,
    }));
  }

  /**
   * Get the latest batch number
   */
  async getLatestBatch(): Promise<number> {
    const result = await this.db.query<{ max_batch: number | null }>(
      `SELECT MAX(batch) as max_batch FROM ${this.tableName}`
    );

    return result.rows[0]?.max_batch ?? 0;
  }

  /**
   * Record a migration as applied
   */
  async recordMigration(name: string, batch: number): Promise<void> {
    await this.db.execute(
      `INSERT INTO ${this.tableName} (name, batch) VALUES ($1, $2)`,
      [name, batch]
    );
  }

  /**
   * Remove a migration record
   */
  async removeMigration(name: string): Promise<void> {
    await this.db.execute(
      `DELETE FROM ${this.tableName} WHERE name = $1`,
      [name]
    );
  }

  /**
   * Get migrations from a specific batch
   */
  async getMigrationsByBatch(batch: number): Promise<MigrationRecord[]> {
    const result = await this.db.query<{
      id: number;
      name: string;
      applied_at: Date;
      batch: number;
    }>(
      `SELECT id, name, applied_at, batch FROM ${this.tableName} WHERE batch = $1 ORDER BY id DESC`,
      [batch]
    );

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      appliedAt: new Date(row.applied_at),
      batch: row.batch,
    }));
  }

  /**
   * Get the last N migrations
   */
  async getLastMigrations(count: number): Promise<MigrationRecord[]> {
    const result = await this.db.query<{
      id: number;
      name: string;
      applied_at: Date;
      batch: number;
    }>(
      `SELECT id, name, applied_at, batch FROM ${this.tableName} ORDER BY id DESC LIMIT $1`,
      [count]
    );

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      appliedAt: new Date(row.applied_at),
      batch: row.batch,
    }));
  }

  /**
   * Check if a migration has been applied
   */
  async isMigrationApplied(name: string): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE name = $1`,
      [name]
    );

    return (result.rows[0]?.count ?? 0) > 0;
  }

  /**
   * Get migration count
   */
  async getMigrationCount(): Promise<number> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.tableName}`
    );

    return result.rows[0]?.count ?? 0;
  }
}
