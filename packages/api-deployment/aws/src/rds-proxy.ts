// RDS Proxy connection management for Lambda environments
// Provides IAM-authenticated database connections through RDS Proxy

import type { RDSProxyConfig } from './types';

/**
 * Manages database connections through AWS RDS Proxy.
 *
 * RDS Proxy is essential in Lambda environments because it pools and shares
 * database connections across Lambda invocations, preventing connection exhaustion.
 */
export class RDSProxyManager {
  private config: RDSProxyConfig;
  private connectionCount = 0;
  private iamTokenCache: { token: string; expiresAt: number } | null = null;

  constructor(config: RDSProxyConfig) {
    this.config = config;
  }

  /**
   * Get a database connection configuration with optional IAM auth token.
   * Returns a connection config object suitable for database drivers.
   */
  async getConnection(): Promise<{
    host: string;
    port: number;
    database: string;
    username: string;
    password?: string;
    ssl: boolean;
  }> {
    const maxConnections = this.config.maxConnections ?? 10;
    if (this.connectionCount >= maxConnections) {
      throw new Error(
        `RDS Proxy connection limit reached (${maxConnections}). ` +
          'Consider increasing maxConnections or checking for connection leaks.'
      );
    }

    this.connectionCount++;

    const connectionConfig: {
      host: string;
      port: number;
      database: string;
      username: string;
      password?: string;
      ssl: boolean;
    } = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      username: this.config.username,
      ssl: this.config.ssl,
    };

    if (this.config.useIAMAuth) {
      connectionConfig.password = await this.getIAMAuthToken();
    }

    return connectionConfig;
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(): void {
    if (this.connectionCount > 0) {
      this.connectionCount--;
    }
  }

  /**
   * Get the current number of active connections
   */
  getActiveConnectionCount(): number {
    return this.connectionCount;
  }

  /**
   * Generate or retrieve a cached IAM authentication token.
   * Tokens are valid for 15 minutes; we cache with a 14-minute TTL.
   */
  private async getIAMAuthToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid
    if (this.iamTokenCache && this.iamTokenCache.expiresAt > now) {
      return this.iamTokenCache.token;
    }

    // In a real implementation, this would call AWS RDS.Signer to generate
    // an IAM auth token. For the adapter, we provide the structure and
    // the token generation hook.
    const region = this.config.region || process.env.AWS_REGION || 'us-east-1';
    const token = generateIAMTokenPlaceholder(
      this.config.host,
      this.config.port,
      this.config.username,
      region
    );

    // Cache for 14 minutes (tokens valid for 15)
    this.iamTokenCache = {
      token,
      expiresAt: now + 14 * 60 * 1000,
    };

    return token;
  }

  /**
   * Clear the IAM token cache, forcing a new token on next connection
   */
  clearTokenCache(): void {
    this.iamTokenCache = null;
  }

  /**
   * Reset all connections (useful for cleanup between invocations)
   */
  reset(): void {
    this.connectionCount = 0;
    this.iamTokenCache = null;
  }
}

/**
 * Placeholder for IAM auth token generation.
 * In production, this would use @aws-sdk/rds-signer.
 */
function generateIAMTokenPlaceholder(
  host: string,
  port: number,
  username: string,
  region: string
): string {
  return `iam-token://${region}/${host}:${port}/${username}`;
}

/**
 * Create an RDS Proxy configuration from environment variables.
 *
 * Expected env vars:
 * - RDS_PROXY_ENDPOINT: Proxy hostname
 * - RDS_DB_NAME: Database name
 * - RDS_USERNAME: Database username
 * - RDS_DB_PORT: Database port (default: 5432)
 * - RDS_USE_IAM_AUTH: Whether to use IAM auth ('true'/'false')
 * - AWS_REGION: AWS region for IAM auth
 */
export function createRDSProxyConfig(
  overrides?: Partial<RDSProxyConfig>
): RDSProxyConfig {
  const host = overrides?.host || process.env.RDS_PROXY_ENDPOINT;
  if (!host) {
    throw new Error(
      'RDS Proxy endpoint not configured. Set RDS_PROXY_ENDPOINT environment variable.'
    );
  }

  const database = overrides?.database || process.env.RDS_DB_NAME;
  if (!database) {
    throw new Error(
      'Database name not configured. Set RDS_DB_NAME environment variable.'
    );
  }

  const username = overrides?.username || process.env.RDS_USERNAME;
  if (!username) {
    throw new Error(
      'Database username not configured. Set RDS_USERNAME environment variable.'
    );
  }

  return {
    host,
    port: overrides?.port ?? parseInt(process.env.RDS_DB_PORT || '5432', 10),
    database,
    username,
    useIAMAuth: overrides?.useIAMAuth ?? process.env.RDS_USE_IAM_AUTH === 'true',
    region: overrides?.region || process.env.AWS_REGION,
    ssl: overrides?.ssl ?? true,
    maxConnections: overrides?.maxConnections ?? 10,
    idleTimeoutMs: overrides?.idleTimeoutMs ?? 60000,
  };
}
