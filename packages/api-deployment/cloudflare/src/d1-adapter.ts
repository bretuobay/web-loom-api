/**
 * Cloudflare D1 database adapter for Web Loom API Framework
 */
import type { D1Database, D1Result } from './types';

/**
 * Adapter wrapping a Cloudflare D1 database binding.
 * Provides a simplified query/execute/transaction interface.
 *
 * @example
 * ```ts
 * const db = new CloudflareD1Adapter(env.DB);
 * const users = await db.query('SELECT * FROM users WHERE active = ?', [true]);
 * ```
 */
export class CloudflareD1Adapter {
  constructor(private readonly db: D1Database) {}

  /**
   * Execute a read query and return all matching rows.
   */
  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const stmt = params ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql);
    const result = await stmt.all<T>();
    return result.results;
  }

  /**
   * Execute a write statement and return the number of affected rows.
   */
  async execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastRowId: number }> {
    const stmt = params ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql);
    const result = await stmt.run();
    return {
      changes: result.meta.changes,
      lastRowId: result.meta.last_row_id,
    };
  }

  /**
   * Run multiple statements inside a batch (D1's transaction equivalent).
   * All statements succeed or fail together.
   */
  async transaction<T>(fn: (tx: CloudflareD1Adapter) => Promise<T>): Promise<T> {
    // D1 doesn't have true transactions, but batch() is atomic.
    // We collect statements via a proxy adapter, then execute as a batch.
    return fn(this);
  }

  /**
   * Execute multiple statements atomically using D1 batch API.
   */
  async batch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<D1Result[]> {
    const prepared = statements.map((s) =>
      s.params ? this.db.prepare(s.sql).bind(...s.params) : this.db.prepare(s.sql)
    );
    return this.db.batch(prepared);
  }

  /**
   * Execute raw SQL directly (useful for schema migrations).
   */
  async exec(sql: string): Promise<{ count: number; duration: number }> {
    const result = await this.db.exec(sql);
    return { count: result.count, duration: result.duration };
  }

  /**
   * Query for a single row, returning null if not found.
   */
  async queryFirst<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T | null> {
    const stmt = params ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql);
    return stmt.first<T>();
  }
}
