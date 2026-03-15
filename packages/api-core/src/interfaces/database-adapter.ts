/**
 * Database Adapter Interface
 * 
 * Abstracts database connections and ORMs (e.g., Drizzle, Prisma, Kysely) to provide
 * a unified interface for database operations, query execution, and schema management.
 * 
 * This adapter enables the framework to support multiple databases and ORMs,
 * allowing developers to choose the best tool for their use case.
 * 
 * **Default Implementation:** Drizzle ORM + Neon (serverless Postgres)
 * **Alternative Implementations:** Prisma, Kysely, MongoDB, DynamoDB
 * 
 * @example
 * ```typescript
 * const adapter = new DrizzleAdapter();
 * await adapter.connect({ url: process.env.DATABASE_URL });
 * 
 * const users = await adapter.query('SELECT * FROM users WHERE id = $1', ['123']);
 * await adapter.disconnect();
 * ```
 * 
 * **Requirements:** 2.2, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

// Import DatabaseConfig from config module to avoid duplication
import type { DatabaseConfig } from '../config/types';

export interface DatabaseAdapter {
  /**
   * Establish a connection to the database
   * 
   * Initializes connection pooling and prepares the adapter for query execution.
   * Should be called during application startup.
   * 
   * @param config - Database configuration including connection URL and pool settings
   * @returns Promise that resolves when connection is established
   * 
   * @throws {DatabaseError} If connection fails after retries
   * 
   * @example
   * ```typescript
   * await adapter.connect({
   *   url: 'postgresql://user:pass@host:5432/db',
   *   poolSize: 10,
   *   connectionTimeout: 10000
   * });
   * ```
   */
  connect(config: DatabaseConfig): Promise<void>;

  /**
   * Close all database connections gracefully
   * 
   * Waits for active queries to complete and releases all connections.
   * Should be called during application shutdown.
   * 
   * @returns Promise that resolves when all connections are closed
   * 
   * @example
   * ```typescript
   * await adapter.disconnect();
   * ```
   */
  disconnect(): Promise<void>;

  /**
   * Check if the database connection is healthy
   * 
   * Executes a simple query to verify connectivity. Used by health check endpoints.
   * 
   * @returns Promise resolving to true if healthy, false otherwise
   * 
   * @example
   * ```typescript
   * const isHealthy = await adapter.healthCheck();
   * if (!isHealthy) {
   *   console.error('Database connection unhealthy');
   * }
   * ```
   */
  healthCheck(): Promise<boolean>;

  /**
   * Execute a SQL query and return results
   * 
   * Uses parameterized queries to prevent SQL injection. Supports prepared statements
   * for performance optimization.
   * 
   * @param sql - SQL query string with parameter placeholders ($1, $2, etc.)
   * @param params - Query parameters to bind
   * @returns Promise resolving to array of result rows
   * 
   * @example
   * ```typescript
   * const users = await adapter.query<User>(
   *   'SELECT * FROM users WHERE age > $1 AND status = $2',
   *   [18, 'active']
   * );
   * ```
   */
  query<T>(sql: string, params: unknown[]): Promise<T[]>;

  /**
   * Execute a SQL statement without returning results
   * 
   * Used for INSERT, UPDATE, DELETE, and DDL statements where result rows
   * are not needed.
   * 
   * @param sql - SQL statement with parameter placeholders
   * @param params - Statement parameters to bind
   * @returns Promise that resolves when execution completes
   * 
   * @example
   * ```typescript
   * await adapter.execute(
   *   'UPDATE users SET last_login = $1 WHERE id = $2',
   *   [new Date(), '123']
   * );
   * ```
   */
  execute(sql: string, params: unknown[]): Promise<void>;

  /**
   * Execute multiple operations within a database transaction
   * 
   * Provides ACID guarantees - all operations succeed or all are rolled back.
   * Automatically commits on success or rolls back on error.
   * 
   * @param callback - Function containing transaction operations
   * @returns Promise resolving to the callback's return value
   * 
   * @throws {DatabaseError} If transaction fails and is rolled back
   * 
   * @example
   * ```typescript
   * const result = await adapter.transaction(async (tx) => {
   *   await tx.execute('INSERT INTO orders (user_id, total) VALUES ($1, $2)', [userId, 100]);
   *   await tx.execute('UPDATE users SET balance = balance - $1 WHERE id = $2', [100, userId]);
   *   return { success: true };
   * });
   * ```
   */
  transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>;

  /**
   * Build and execute a SELECT query for a model
   * 
   * Returns a query builder for constructing type-safe SELECT queries with
   * filtering, sorting, pagination, and relationship loading.
   * 
   * @param model - Model definition to query
   * @returns Query builder for chaining operations
   * 
   * @example
   * ```typescript
   * const users = await adapter.select(UserModel)
   *   .where({ status: 'active' })
   *   .orderBy('createdAt', 'desc')
   *   .limit(20)
   *   .execute();
   * ```
   */
  select<T>(model: ModelDefinition): QueryBuilder<T>;

  /**
   * Insert a new record into the database
   * 
   * Validates data against model schema, applies defaults, and returns
   * the created record with generated fields (id, timestamps).
   * 
   * @param model - Model definition
   * @param data - Data to insert
   * @returns Promise resolving to the created record
   * 
   * @example
   * ```typescript
   * const user = await adapter.insert(UserModel, {
   *   email: 'user@example.com',
   *   name: 'John Doe'
   * });
   * ```
   */
  insert<T>(model: ModelDefinition, data: T): Promise<T>;

  /**
   * Update an existing record by ID
   * 
   * Performs partial update, only modifying specified fields.
   * Supports optimistic locking if enabled on the model.
   * 
   * @param model - Model definition
   * @param id - Record ID to update
   * @param data - Fields to update
   * @returns Promise resolving to the updated record
   * 
   * @throws {NotFoundError} If record with ID doesn't exist
   * @throws {ConflictError} If optimistic lock version mismatch
   * 
   * @example
   * ```typescript
   * const user = await adapter.update(UserModel, '123', {
   *   name: 'Jane Doe'
   * });
   * ```
   */
  update<T>(model: ModelDefinition, id: string, data: Partial<T>): Promise<T>;

  /**
   * Delete a record by ID
   * 
   * Performs hard delete or soft delete based on model configuration.
   * Handles cascade deletes for related records.
   * 
   * @param model - Model definition
   * @param id - Record ID to delete
   * @returns Promise that resolves when deletion completes
   * 
   * @throws {NotFoundError} If record with ID doesn't exist
   * @throws {ConflictError} If foreign key constraints prevent deletion
   * 
   * @example
   * ```typescript
   * await adapter.delete(UserModel, '123');
   * ```
   */
  delete(model: ModelDefinition, id: string): Promise<void>;

  /**
   * Create a database table from a model definition
   * 
   * Generates and executes CREATE TABLE DDL based on model schema.
   * Used during initial setup and migrations.
   * 
   * @param model - Model definition
   * @returns Promise that resolves when table is created
   * 
   * @example
   * ```typescript
   * await adapter.createTable(UserModel);
   * ```
   */
  createTable(model: ModelDefinition): Promise<void>;

  /**
   * Drop a database table
   * 
   * Permanently deletes the table and all its data.
   * Supports CASCADE option for dropping dependent objects.
   * 
   * @param model - Model definition
   * @returns Promise that resolves when table is dropped
   * 
   * @example
   * ```typescript
   * await adapter.dropTable(UserModel);
   * ```
   */
  dropTable(model: ModelDefinition): Promise<void>;

  /**
   * Apply a database migration
   * 
   * Executes migration SQL within a transaction, rolling back on error.
   * Records migration in migrations table for tracking.
   * 
   * @param migration - Migration definition with up/down SQL
   * @returns Promise that resolves when migration is applied
   * 
   * @example
   * ```typescript
   * await adapter.migrateSchema({
   *   name: '001_add_users_table',
   *   up: 'CREATE TABLE users (...)',
   *   down: 'DROP TABLE users'
   * });
   * ```
   */
  migrateSchema(migration: Migration): Promise<void>;
}

/**
 * Transaction interface for executing operations within a transaction
 * 
 * Provides the same query/execute methods as the main adapter,
 * but all operations are part of the same transaction.
 */
export interface Transaction {
  /**
   * Execute a query within the transaction
   * 
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Promise resolving to result rows
   */
  query<T>(sql: string, params: unknown[]): Promise<T[]>;

  /**
   * Execute a statement within the transaction
   * 
   * @param sql - SQL statement
   * @param params - Statement parameters
   * @returns Promise that resolves when execution completes
   */
  execute(sql: string, params: unknown[]): Promise<void>;

  /**
   * Commit the transaction
   * 
   * Makes all changes permanent. Called automatically on success.
   * 
   * @returns Promise that resolves when commit completes
   */
  commit(): Promise<void>;

  /**
   * Roll back the transaction
   * 
   * Discards all changes. Called automatically on error.
   * 
   * @returns Promise that resolves when rollback completes
   */
  rollback(): Promise<void>;
}

/**
 * Model definition for database operations
 * 
 * Defines the structure, validation, and database mapping for a data model.
 */
export interface ModelDefinition {
  /** Model name (PascalCase) */
  name: string;
  
  /** Database table name (snake_case) */
  tableName?: string;
  
  /** Field definitions */
  fields: FieldDefinition[];
  
  /** Relationships to other models */
  relationships?: Relationship[];
  
  /** Model-level options */
  options?: ModelOptions;
}

/**
 * Field definition within a model
 */
export interface FieldDefinition {
  /** Field name */
  name: string;
  
  /** Field type (string, number, boolean, date, etc.) */
  type: string;
  
  /** Whether field is required */
  required?: boolean;
  
  /** Whether field is unique */
  unique?: boolean;
  
  /** Default value or function */
  default?: unknown | (() => unknown);
  
  /** Database column configuration */
  database?: DatabaseFieldConfig;
}

/**
 * Database-specific field configuration
 */
export interface DatabaseFieldConfig {
  /** Database column name (if different from field name) */
  columnName?: string;
  
  /** Database column type (e.g., 'VARCHAR(255)', 'INTEGER') */
  columnType?: string;
  
  /** Whether column is indexed */
  indexed?: boolean;
  
  /** Whether column is primary key */
  primaryKey?: boolean;
}

/**
 * Relationship definition between models
 */
export interface Relationship {
  /** Relationship type */
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'manyToMany';
  
  /** Target model name */
  target: string;
  
  /** Foreign key field name */
  foreignKey?: string;
  
  /** Join table name (for many-to-many) */
  through?: string;
}

/**
 * Model-level options
 */
export interface ModelOptions {
  /** Automatically add createdAt/updatedAt timestamps */
  timestamps?: boolean;
  
  /** Enable soft deletes (deletedAt field) */
  softDelete?: boolean;
  
  /** Enable optimistic locking (version field) */
  optimisticLocking?: boolean;
}

/**
 * Query builder for constructing type-safe queries
 */
export interface QueryBuilder<T> {
  /** Add WHERE conditions */
  where(conditions: Partial<T>): QueryBuilder<T>;
  
  /** Add ORDER BY clause */
  orderBy(field: keyof T, direction: 'asc' | 'desc'): QueryBuilder<T>;
  
  /** Limit number of results */
  limit(count: number): QueryBuilder<T>;
  
  /** Skip number of results (for pagination) */
  offset(count: number): QueryBuilder<T>;
  
  /** Execute the query and return results */
  execute(): Promise<T[]>;
}

/**
 * Database migration definition
 */
export interface Migration {
  /** Migration name/identifier */
  name: string;
  
  /** SQL to apply migration */
  up: string;
  
  /** SQL to revert migration */
  down: string;
  
  /** Migration timestamp */
  timestamp?: Date;
}
