/**
 * Mock database adapter for isolated testing
 */

export interface QueryRecord {
  sql: string;
  params?: unknown[];
  timestamp: number;
}

export type QueryHandler = (sql: string, params?: unknown[]) => unknown;

export interface MockDatabase {
  /** Execute a query and return mocked results */
  query<T = unknown>(sql: string, params?: unknown[]): T;
  /** Execute a mutation and return affected row count */
  execute(sql: string, params?: unknown[]): { affectedRows: number };
  /** Register a handler for queries matching a pattern */
  onQuery(pattern: string | RegExp, handler: QueryHandler): void;
  /** Get all recorded queries */
  getQueries(): QueryRecord[];
  /** Run a function inside a mock transaction */
  transaction<T>(fn: (tx: MockDatabase) => T | Promise<T>): Promise<T>;
  /** Reset all mocks and recorded queries */
  reset(): void;
}

export function createMockDatabase(): MockDatabase {
  let queries: QueryRecord[] = [];
  const handlers: Array<{ pattern: string | RegExp; handler: QueryHandler }> = [];
  let defaultQueryResult: unknown = [];
  let defaultExecuteResult = { affectedRows: 0 };

  function findHandler(sql: string): QueryHandler | undefined {
    for (const { pattern, handler } of handlers) {
      if (typeof pattern === 'string') {
        if (sql.toLowerCase().includes(pattern.toLowerCase())) {
          return handler;
        }
      } else if (pattern.test(sql)) {
        return handler;
      }
    }
    return undefined;
  }

  const db: MockDatabase = {

    query<T = unknown>(sql: string, params?: unknown[]): T {
      queries.push({ sql, params, timestamp: Date.now() });
      const handler = findHandler(sql);
      if (handler) {
        return handler(sql, params) as T;
      }
      return defaultQueryResult as T;
    },

    execute(sql: string, params?: unknown[]): { affectedRows: number } {
      queries.push({ sql, params, timestamp: Date.now() });
      const handler = findHandler(sql);
      if (handler) {
        const result = handler(sql, params);
        if (
          result &&
          typeof result === 'object' &&
          'affectedRows' in (result as Record<string, unknown>)
        ) {
          return result as { affectedRows: number };
        }
        return { affectedRows: 1 };
      }
      return { ...defaultExecuteResult };
    },

    onQuery(pattern: string | RegExp, handler: QueryHandler): void {
      handlers.push({ pattern, handler });
    },

    getQueries(): QueryRecord[] {
      return [...queries];
    },

    async transaction<T>(fn: (tx: MockDatabase) => T | Promise<T>): Promise<T> {
      // Create a child mock that shares handlers but tracks its own queries
      const txQueries: QueryRecord[] = [];
      const txDb: MockDatabase = {
        query<U = unknown>(sql: string, params?: unknown[]): U {
          const record = { sql, params, timestamp: Date.now() };
          txQueries.push(record);
          queries.push(record);
          const h = findHandler(sql);
          if (h) return h(sql, params) as U;
          return defaultQueryResult as U;
        },
        execute(sql: string, params?: unknown[]) {
          const record = { sql, params, timestamp: Date.now() };
          txQueries.push(record);
          queries.push(record);
          const h = findHandler(sql);
          if (h) {
            const r = h(sql, params);
            if (r && typeof r === 'object' && 'affectedRows' in (r as Record<string, unknown>)) {
              return r as { affectedRows: number };
            }
            return { affectedRows: 1 };
          }
          return { ...defaultExecuteResult };
        },
        onQuery: db.onQuery,
        getQueries: () => [...txQueries],
        transaction: db.transaction,
        reset: db.reset,
      };

      return fn(txDb);
    },

    reset(): void {
      queries = [];
      handlers.length = 0;
      defaultQueryResult = [];
      defaultExecuteResult = { affectedRows: 0 };
    },
  };

  return db;
}
