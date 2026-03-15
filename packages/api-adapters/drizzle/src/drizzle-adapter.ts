/**
 * Drizzle Database Adapter
 * 
 * Implementation of DatabaseAdapter using Drizzle ORM with Neon serverless Postgres.
 * Optimized for serverless and edge computing with connection pooling and prepared statements.
 * 
 * @example
 * ```typescript
 * const adapter = new DrizzleAdapter();
 * await adapter.connect({ url: process.env.DATABASE_URL });
 * 
 * const users = await adapter.query('SELECT * FROM users WHERE id = $1', ['123']);
 * await adapter.disconnect();
 * ```
 */

import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import type {
  DatabaseAdapter,
  Transaction,
  ModelDefinition,
  QueryBuilder,
  Migration,
  DatabaseConfig,
} from '@web-loom/api-core';

/**
 * Drizzle adapter implementation
 */
export class DrizzleAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;
  private _db: NeonDatabase<Record<string, never>> | null = null;
  private _config: DatabaseConfig | null = null;

  /**
   * Establish connection to Neon Postgres database
   */
  async connect(config: DatabaseConfig): Promise<void> {
    this._config = config;

    // Configure Neon for serverless
    neonConfig.fetchConnectionCache = true;

    // Create connection pool
    this.pool = new Pool({ connectionString: config.url });

    // Initialize Drizzle with the pool
    this._db = drizzle(this.pool);

    // Test connection
    const isHealthy = await this.healthCheck();
    if (!isHealthy) {
      throw new Error('Failed to establish database connection');
    }
  }

  /**
   * Close all database connections
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this._db = null;
    }
  }

  /**
   * Check database connection health
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.pool) return false;
      
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute a SQL query and return results
   */
  async query<T>(sql: string, params: unknown[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows as T[];
    } finally {
      client.release();
    }
  }

  /**
   * Execute a SQL statement without returning results
   */
  async execute(sql: string, params: unknown[]): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const client = await this.pool.connect();
    try {
      await client.query(sql, params);
    } finally {
      client.release();
    }
  }

  /**
   * Execute operations within a transaction
   */
  async transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const tx: Transaction = {
        query: async <R>(sql: string, params: unknown[]): Promise<R[]> => {
          const result = await client.query(sql, params);
          return result.rows as R[];
        },
        execute: async (sql: string, params: unknown[]): Promise<void> => {
          await client.query(sql, params);
        },
        commit: async (): Promise<void> => {
          await client.query('COMMIT');
        },
        rollback: async (): Promise<void> => {
          await client.query('ROLLBACK');
        },
      };

      const result = await callback(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Build a SELECT query for a model
   */
  select<T>(model: ModelDefinition): QueryBuilder<T> {
    const tableName = model.tableName || this.toSnakeCase(model.name);
    
    return new DrizzleQueryBuilder<T>(this, tableName);
  }

  /**
   * Insert a new record
   */
  async insert<T>(model: ModelDefinition, data: T): Promise<T> {
    const tableName = model.tableName || this.toSnakeCase(model.name);
    
    // Build INSERT query
    const fields = Object.keys(data as object);
    const values = Object.values(data as object);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    
    const sql = `
      INSERT INTO ${tableName} (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await this.query<T>(sql, values);
    if (!result[0]) {
      throw new Error('Insert failed: no record returned');
    }
    return result[0];
  }

  /**
   * Update an existing record by ID
   */
  async update<T>(model: ModelDefinition, id: string, data: Partial<T>): Promise<T> {
    const tableName = model.tableName || this.toSnakeCase(model.name);
    
    // Build UPDATE query
    const fields = Object.keys(data as object);
    const values = Object.values(data as object);
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
    
    const sql = `
      UPDATE ${tableName}
      SET ${setClause}
      WHERE id = $${fields.length + 1}
      RETURNING *
    `;
    
    const result = await this.query<T>(sql, [...values, id]);
    
    if (result.length === 0 || !result[0]) {
      throw new Error(`Record with id ${id} not found`);
    }
    
    return result[0];
  }

  /**
   * Delete a record by ID
   */
  async delete(model: ModelDefinition, id: string): Promise<void> {
    const tableName = model.tableName || this.toSnakeCase(model.name);
    
    const sql = `DELETE FROM ${tableName} WHERE id = $1`;
    await this.execute(sql, [id]);
  }

  /**
   * Create a database table from model definition
   */
  async createTable(model: ModelDefinition): Promise<void> {
    const tableName = model.tableName || this.toSnakeCase(model.name);
    
    // Build CREATE TABLE DDL
    const columns = model.fields.map((field: { name: string; type: string; database?: { columnName?: string; columnType?: string; primaryKey?: boolean }; required?: boolean; unique?: boolean; default?: unknown }) => {
      const columnName = field.database?.columnName || field.name;
      const columnType = field.database?.columnType || this.mapFieldType(field.type);
      const constraints: string[] = [];
      
      if (field.database?.primaryKey) {
        constraints.push('PRIMARY KEY');
      }
      if (field.required) {
        constraints.push('NOT NULL');
      }
      if (field.unique) {
        constraints.push('UNIQUE');
      }
      if (field.default !== undefined) {
        constraints.push(`DEFAULT ${this.formatDefault(field.default)}`);
      }
      
      return `${columnName} ${columnType} ${constraints.join(' ')}`.trim();
    });
    
    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(', ')})`;
    await this.execute(sql, []);
  }

  /**
   * Drop a database table
   */
  async dropTable(model: ModelDefinition): Promise<void> {
    const tableName = model.tableName || this.toSnakeCase(model.name);
    
    const sql = `DROP TABLE IF EXISTS ${tableName} CASCADE`;
    await this.execute(sql, []);
  }

  /**
   * Apply a database migration
   */
  async migrateSchema(migration: Migration): Promise<void> {
    await this.transaction(async (tx) => {
      // Execute migration SQL
      await tx.execute(migration.up, []);
      
      // Record migration in migrations table
      await tx.execute(
        `INSERT INTO migrations (name, applied_at) VALUES ($1, $2)`,
        [migration.name, new Date()]
      );
    });
  }

  /**
   * Convert PascalCase to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
  }

  /**
   * Map field type to database column type
   */
  private mapFieldType(type: string): string {
    const typeMap: Record<string, string> = {
      string: 'TEXT',
      number: 'INTEGER',
      boolean: 'BOOLEAN',
      date: 'TIMESTAMP',
      uuid: 'UUID',
      json: 'JSONB',
      decimal: 'DECIMAL',
    };
    
    return typeMap[type] || 'TEXT';
  }

  /**
   * Format default value for SQL
   */
  private formatDefault(value: unknown): string {
    if (typeof value === 'string') {
      return `'${value}'`;
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    if (value === null) {
      return 'NULL';
    }
    return String(value);
  }
}

/**
 * Query builder implementation
 */
class DrizzleQueryBuilder<T> implements QueryBuilder<T> {
  private conditions: Partial<T> = {};
  private orderByField?: keyof T;
  private orderByDirection?: 'asc' | 'desc';
  private limitCount?: number;
  private offsetCount?: number;

  constructor(
    private adapter: DrizzleAdapter,
    private tableName: string
  ) {}

  where(conditions: Partial<T>): QueryBuilder<T> {
    this.conditions = { ...this.conditions, ...conditions };
    return this;
  }

  orderBy(field: keyof T, direction: 'asc' | 'desc'): QueryBuilder<T> {
    this.orderByField = field;
    this.orderByDirection = direction;
    return this;
  }

  limit(count: number): QueryBuilder<T> {
    this.limitCount = count;
    return this;
  }

  offset(count: number): QueryBuilder<T> {
    this.offsetCount = count;
    return this;
  }

  async execute(): Promise<T[]> {
    // Build SELECT query
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    // Add WHERE clause
    if (Object.keys(this.conditions).length > 0) {
      const whereClauses = Object.entries(this.conditions).map(([key, value]) => {
        params.push(value);
        return `${key} = $${paramIndex++}`;
      });
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // Add ORDER BY clause
    if (this.orderByField) {
      sql += ` ORDER BY ${String(this.orderByField)} ${this.orderByDirection?.toUpperCase()}`;
    }

    // Add LIMIT clause
    if (this.limitCount !== undefined) {
      sql += ` LIMIT ${this.limitCount}`;
    }

    // Add OFFSET clause
    if (this.offsetCount !== undefined) {
      sql += ` OFFSET ${this.offsetCount}`;
    }

    return this.adapter.query<T>(sql, params);
  }
}
