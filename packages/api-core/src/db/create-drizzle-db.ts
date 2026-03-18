/**
 * Multi-driver Drizzle DB initialisation
 *
 * Supports three drivers out of the box:
 *  - `neon-serverless` — Neon Postgres via HTTP (edge-safe)
 *  - `libsql`          — Turso / local SQLite via libsql
 *  - `pg`              — Standard node-postgres (long-running servers / Docker)
 *
 * Each driver is loaded with a dynamic import so that unused drivers are
 * not bundled in edge builds.
 */

import type { AnyDrizzleDB } from '../types';
import { ConfigurationError } from '../errors/configuration-error';

export type DrizzleDriver = 'neon-serverless' | 'libsql' | 'pg';

export interface DrizzleDbConfig {
  /** Database connection URL (env vars already resolved by defineConfig) */
  url: string;
  /** Which Drizzle driver to use */
  driver: DrizzleDriver;
  /** Enable TLS for the pg driver (ignored by other drivers) */
  ssl?: boolean;
  /** Maximum pool size for the pg driver */
  poolSize?: number;
}

/**
 * Create and return a Drizzle ORM database instance for the configured driver.
 *
 * @throws {ConfigurationError} for unsupported driver values
 */
export async function createDrizzleDb(config: DrizzleDbConfig): Promise<AnyDrizzleDB> {
  const { driver, url } = config;

  switch (driver) {
    case 'neon-serverless': {
      const { neon } = await import('@neondatabase/serverless');
      const { drizzle } = await import('drizzle-orm/neon-serverless');
      return drizzle({ client: neon(url) });
    }

    case 'libsql': {
      const { createClient } = await import('@libsql/client');
      const { drizzle } = await import('drizzle-orm/libsql');
      return drizzle(createClient({ url }));
    }

    case 'pg': {
      const { Pool } = await import('pg');
      const { drizzle } = await import('drizzle-orm/node-postgres');
      const pool = new Pool({
        connectionString: url,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
        max: config.poolSize,
      });
      return drizzle({ client: pool });
    }

    default: {
      throw new ConfigurationError(
        `Unknown database driver: "${(config as { driver: string }).driver}". ` +
          `Valid options are: neon-serverless, libsql, pg`
      );
    }
  }
}
