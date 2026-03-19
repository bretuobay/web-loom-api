/**
 * Migration Tracker
 *
 * Handles tracking of applied migrations in the database.
 * Uses a minimal DB interface compatible with any Drizzle driver's
 * raw query capability.
 */

export interface MigrationDB {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T = unknown>(sql: string, params: unknown[]): Promise<T[]>;
  execute(sql: string, params: unknown[]): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transaction<T>(fn: (trx: any) => Promise<T>): Promise<T>;
}

export interface MigrationRecord {
  id: number;
  name: string;
  appliedAt: Date;
  batch: number;
}

export class MigrationTracker {
  private db: MigrationDB;
  private tableName: string;

  constructor(db: MigrationDB, tableName = 'migrations') {
    this.db = db;
    this.tableName = tableName;
  }

  async ensureTable(): Promise<void> {
    const tableExists = await this.checkTableExists();
    if (!tableExists) {
      await this.createTable();
    }
  }

  private async checkTableExists(): Promise<boolean> {
    try {
      await this.db.query(`SELECT 1 FROM ${this.tableName} LIMIT 1`, []);
      return true;
    } catch {
      return false;
    }
  }

  private async createTable(): Promise<void> {
    await this.db.execute(
      `CREATE TABLE ${this.tableName} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
        batch INTEGER NOT NULL
      )`,
      []
    );
  }

  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.db.query<{
      id: number;
      name: string;
      applied_at: Date;
      batch: number;
    }>(`SELECT id, name, applied_at, batch FROM ${this.tableName} ORDER BY id ASC`, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      appliedAt: new Date(row.applied_at),
      batch: row.batch,
    }));
  }

  async getLatestBatch(): Promise<number> {
    const result = await this.db.query<{ max_batch: number | null }>(
      `SELECT MAX(batch) as max_batch FROM ${this.tableName}`,
      []
    );
    return result[0]?.max_batch ?? 0;
  }

  async recordMigration(name: string, batch: number): Promise<void> {
    await this.db.execute(
      `INSERT INTO ${this.tableName} (name, batch) VALUES ($1, $2)`,
      [name, batch]
    );
  }

  async removeMigration(name: string): Promise<void> {
    await this.db.execute(`DELETE FROM ${this.tableName} WHERE name = $1`, [name]);
  }

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      appliedAt: new Date(row.applied_at),
      batch: row.batch,
    }));
  }

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      appliedAt: new Date(row.applied_at),
      batch: row.batch,
    }));
  }

  async isMigrationApplied(name: string): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE name = $1`,
      [name]
    );
    return (result[0]?.count ?? 0) > 0;
  }

  async getMigrationCount(): Promise<number> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.tableName}`,
      []
    );
    return result[0]?.count ?? 0;
  }
}
