/**
 * Options for generating a Dockerfile.
 */
export interface DockerfileOptions {
  /** Node.js base image version (default: '20-alpine') */
  nodeVersion?: string;
  /** Port to expose (default: 3000) */
  port?: number;
  /** Package manager to use for install/build commands (default: 'npm') */
  packageManager?: 'npm' | 'pnpm' | 'yarn';
  /** Health check endpoint path (default: '/health/live') */
  healthCheckPath?: string;
  /** Whether to include a HEALTHCHECK instruction (default: true) */
  enableHealthCheck?: boolean;
}

/**
 * Options for generating a docker-compose.yml.
 */
export interface DockerComposeOptions {
  /** Application service name (default: 'app') */
  appName?: string;
  /** Host port to map to the app container (default: 3000) */
  port?: number;
  /** Database service to include ('postgres' | 'mysql' | 'none') (default: 'none') */
  database?: 'postgres' | 'mysql' | 'none';
  /** Whether to include a Redis service (default: false) */
  redis?: boolean;
  /** Whether to use named volumes for persistence (default: true) */
  volumes?: boolean;
}
