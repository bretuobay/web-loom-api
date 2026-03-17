import type { DockerComposeOptions } from './types';

const DEFAULTS: Required<DockerComposeOptions> = {
  appName: 'app',
  port: 3000,
  database: 'none',
  redis: false,
  volumes: true,
};

function indent(text: string, level: number): string {
  return ' '.repeat(level * 2) + text;
}

/**
 * Generates a docker-compose.yml string for local development.
 */
export function generateDockerCompose(options: DockerComposeOptions = {}): string {
  const opts = { ...DEFAULTS, ...options };
  const { appName, port, database, redis, volumes } = opts;

  const lines: string[] = [];
  const dependsOn: string[] = [];

  lines.push('services:');

  // ---- app service ----
  lines.push(indent(`${appName}:`, 1));
  lines.push(indent('build:', 2));
  lines.push(indent('context: .', 3));
  lines.push(indent('dockerfile: Dockerfile', 3));
  lines.push(indent('ports:', 2));
  lines.push(indent(`- "${port}:${port}"`, 3));
  lines.push(indent('environment:', 2));
  lines.push(indent(`- NODE_ENV=development`, 3));
  lines.push(indent(`- PORT=${port}`, 3));

  if (database === 'postgres') {
    lines.push(indent('- DATABASE_URL=postgresql://postgres:postgres@db:5432/app_dev', 3));
    dependsOn.push('db');
  } else if (database === 'mysql') {
    lines.push(indent('- DATABASE_URL=mysql://root:mysql@db:3306/app_dev', 3));
    dependsOn.push('db');
  }

  if (redis) {
    lines.push(indent('- REDIS_URL=redis://redis:6379', 3));
    dependsOn.push('redis');
  }

  if (dependsOn.length > 0) {
    lines.push(indent('depends_on:', 2));
    for (const dep of dependsOn) {
      lines.push(indent(`${dep}:`, 3));
      lines.push(indent('condition: service_healthy', 4));
    }
  }

  lines.push(indent('restart: unless-stopped', 2));
  lines.push(indent('networks:', 2));
  lines.push(indent('- app-network', 3));

  // ---- database service ----
  if (database === 'postgres') {
    lines.push('');
    lines.push(indent('db:', 1));
    lines.push(indent('image: postgres:16-alpine', 2));
    lines.push(indent('environment:', 2));
    lines.push(indent('- POSTGRES_USER=postgres', 3));
    lines.push(indent('- POSTGRES_PASSWORD=postgres', 3));
    lines.push(indent('- POSTGRES_DB=app_dev', 3));
    lines.push(indent('ports:', 2));
    lines.push(indent('- "5432:5432"', 3));
    lines.push(indent('healthcheck:', 2));
    lines.push(indent('test: ["CMD-SHELL", "pg_isready -U postgres"]', 3));
    lines.push(indent('interval: 10s', 3));
    lines.push(indent('timeout: 5s', 3));
    lines.push(indent('retries: 5', 3));
    if (volumes) {
      lines.push(indent('volumes:', 2));
      lines.push(indent('- db-data:/var/lib/postgresql/data', 3));
    }
    lines.push(indent('networks:', 2));
    lines.push(indent('- app-network', 3));
  } else if (database === 'mysql') {
    lines.push('');
    lines.push(indent('db:', 1));
    lines.push(indent('image: mysql:8-oracle', 2));
    lines.push(indent('environment:', 2));
    lines.push(indent('- MYSQL_ROOT_PASSWORD=mysql', 3));
    lines.push(indent('- MYSQL_DATABASE=app_dev', 3));
    lines.push(indent('ports:', 2));
    lines.push(indent('- "3306:3306"', 3));
    lines.push(indent('healthcheck:', 2));
    lines.push(indent('test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]', 3));
    lines.push(indent('interval: 10s', 3));
    lines.push(indent('timeout: 5s', 3));
    lines.push(indent('retries: 5', 3));
    if (volumes) {
      lines.push(indent('volumes:', 2));
      lines.push(indent('- db-data:/var/lib/mysql', 3));
    }
    lines.push(indent('networks:', 2));
    lines.push(indent('- app-network', 3));
  }

  // ---- redis service ----
  if (redis) {
    lines.push('');
    lines.push(indent('redis:', 1));
    lines.push(indent('image: redis:7-alpine', 2));
    lines.push(indent('ports:', 2));
    lines.push(indent('- "6379:6379"', 3));
    lines.push(indent('healthcheck:', 2));
    lines.push(indent('test: ["CMD", "redis-cli", "ping"]', 3));
    lines.push(indent('interval: 10s', 3));
    lines.push(indent('timeout: 5s', 3));
    lines.push(indent('retries: 5', 3));
    if (volumes) {
      lines.push(indent('volumes:', 2));
      lines.push(indent('- redis-data:/data', 3));
    }
    lines.push(indent('networks:', 2));
    lines.push(indent('- app-network', 3));
  }

  // ---- networks ----
  lines.push('');
  lines.push('networks:');
  lines.push(indent('app-network:', 1));
  lines.push(indent('driver: bridge', 2));

  // ---- volumes ----
  if (volumes && (database !== 'none' || redis)) {
    lines.push('');
    lines.push('volumes:');
    if (database !== 'none') {
      lines.push(indent('db-data:', 1));
    }
    if (redis) {
      lines.push(indent('redis-data:', 1));
    }
  }

  lines.push('');
  return lines.join('\n');
}
