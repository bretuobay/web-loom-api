import { describe, it, expect } from 'vitest';
import { generateDockerfile } from '../dockerfile-generator';
import { generateDockerCompose } from '../docker-compose-generator';
import { generateDockerignore } from '../dockerignore-generator';

// ---------------------------------------------------------------------------
// generateDockerfile
// ---------------------------------------------------------------------------

describe('generateDockerfile', () => {
  it('produces a valid multi-stage Dockerfile with defaults', () => {
    const result = generateDockerfile();

    expect(result).toContain('FROM node:20-alpine AS base');
    expect(result).toContain('FROM base AS builder');
    expect(result).toContain('FROM node:20-alpine AS runner');
    expect(result).toContain('EXPOSE 3000');
    expect(result).toContain('CMD ["node", "dist/index.js"]');
  });

  it('includes HEALTHCHECK by default', () => {
    const result = generateDockerfile();

    expect(result).toContain('HEALTHCHECK');
    expect(result).toContain('/health/live');
  });

  it('omits HEALTHCHECK when disabled', () => {
    const result = generateDockerfile({ enableHealthCheck: false });

    expect(result).not.toContain('HEALTHCHECK');
  });

  it('uses custom node version and port', () => {
    const result = generateDockerfile({ nodeVersion: '18-slim', port: 8080 });

    expect(result).toContain('FROM node:18-slim AS base');
    expect(result).toContain('EXPOSE 8080');
    expect(result).toContain('http://localhost:8080/health/live');
  });

  it('uses custom health check path', () => {
    const result = generateDockerfile({ healthCheckPath: '/api/health' });

    expect(result).toContain('/api/health');
  });

  it('creates non-root user for security', () => {
    const result = generateDockerfile();

    expect(result).toContain('addgroup --system');
    expect(result).toContain('adduser --system');
    expect(result).toContain('USER appuser');
  });

  it('uses npm ci for npm package manager', () => {
    const result = generateDockerfile({ packageManager: 'npm' });

    expect(result).toContain('RUN npm ci');
    expect(result).toContain('RUN npm run build');
    expect(result).toContain('package-lock.json');
  });

  it('uses pnpm commands for pnpm package manager', () => {
    const result = generateDockerfile({ packageManager: 'pnpm' });

    expect(result).toContain('pnpm install --frozen-lockfile');
    expect(result).toContain('pnpm run build');
    expect(result).toContain('pnpm-lock.yaml');
    expect(result).toContain('CMD ["pnpm", "start"]');
  });

  it('uses yarn commands for yarn package manager', () => {
    const result = generateDockerfile({ packageManager: 'yarn' });

    expect(result).toContain('yarn install --frozen-lockfile');
    expect(result).toContain('yarn build');
    expect(result).toContain('yarn.lock');
    expect(result).toContain('CMD ["yarn", "start"]');
  });

  it('copies only production artifacts in runner stage', () => {
    const result = generateDockerfile();

    expect(result).toContain('COPY --from=builder /app/dist ./dist');
    expect(result).toContain('COPY --from=builder /app/package.json ./');
    expect(result).toContain('COPY --from=builder /app/node_modules ./node_modules');
  });

  it('sets NODE_ENV to production in runner stage', () => {
    const result = generateDockerfile();

    expect(result).toContain('ENV NODE_ENV=production');
  });
});

// ---------------------------------------------------------------------------
// generateDockerCompose
// ---------------------------------------------------------------------------

describe('generateDockerCompose', () => {
  it('generates minimal compose with app service only', () => {
    const result = generateDockerCompose();

    expect(result).toContain('services:');
    expect(result).toContain('app:');
    expect(result).toContain('build:');
    expect(result).toContain('dockerfile: Dockerfile');
    expect(result).toContain('"3000:3000"');
    expect(result).toContain('restart: unless-stopped');
    expect(result).toContain('networks:');
    expect(result).toContain('app-network:');
    expect(result).not.toContain('db:');
    expect(result).not.toContain('redis:');
  });

  it('uses custom app name and port', () => {
    const result = generateDockerCompose({ appName: 'api', port: 8080 });

    expect(result).toContain('api:');
    expect(result).toContain('"8080:8080"');
    expect(result).toContain('PORT=8080');
  });

  it('includes postgres service when database is postgres', () => {
    const result = generateDockerCompose({ database: 'postgres' });

    expect(result).toContain('db:');
    expect(result).toContain('image: postgres:16-alpine');
    expect(result).toContain('POSTGRES_USER=postgres');
    expect(result).toContain('POSTGRES_PASSWORD=postgres');
    expect(result).toContain('POSTGRES_DB=app_dev');
    expect(result).toContain('"5432:5432"');
    expect(result).toContain('pg_isready');
    expect(result).toContain('DATABASE_URL=postgresql://postgres:postgres@db:5432/app_dev');
    expect(result).toContain('depends_on:');
    expect(result).toContain('condition: service_healthy');
    expect(result).toContain('db-data:/var/lib/postgresql/data');
    expect(result).toContain('volumes:');
    expect(result).toContain('db-data:');
  });

  it('includes mysql service when database is mysql', () => {
    const result = generateDockerCompose({ database: 'mysql' });

    expect(result).toContain('db:');
    expect(result).toContain('image: mysql:8-oracle');
    expect(result).toContain('MYSQL_ROOT_PASSWORD=mysql');
    expect(result).toContain('MYSQL_DATABASE=app_dev');
    expect(result).toContain('"3306:3306"');
    expect(result).toContain('mysqladmin');
    expect(result).toContain('DATABASE_URL=mysql://root:mysql@db:3306/app_dev');
    expect(result).toContain('db-data:/var/lib/mysql');
  });

  it('includes redis service when redis is true', () => {
    const result = generateDockerCompose({ redis: true });

    expect(result).toContain('redis:');
    expect(result).toContain('image: redis:7-alpine');
    expect(result).toContain('"6379:6379"');
    expect(result).toContain('redis-cli');
    expect(result).toContain('REDIS_URL=redis://redis:6379');
    expect(result).toContain('redis-data:/data');
    expect(result).toContain('redis-data:');
  });

  it('includes both database and redis when configured', () => {
    const result = generateDockerCompose({ database: 'postgres', redis: true });

    expect(result).toContain('db:');
    expect(result).toContain('redis:');
    expect(result).toContain('db-data:');
    expect(result).toContain('redis-data:');
    // app depends on both
    expect(result).toContain('depends_on:');
  });

  it('omits volumes when volumes is false', () => {
    const result = generateDockerCompose({ database: 'postgres', redis: true, volumes: false });

    expect(result).not.toContain('db-data:');
    expect(result).not.toContain('redis-data:');
    // top-level volumes section should not appear
    expect(result).not.toMatch(/^volumes:/m);
  });

  it('uses bridge network driver', () => {
    const result = generateDockerCompose();

    expect(result).toContain('driver: bridge');
  });
});

// ---------------------------------------------------------------------------
// generateDockerignore
// ---------------------------------------------------------------------------

describe('generateDockerignore', () => {
  it('includes standard node ignores', () => {
    const result = generateDockerignore();

    expect(result).toContain('node_modules');
    expect(result).toContain('dist');
    expect(result).toContain('.git');
    expect(result).toContain('.env');
  });

  it('includes log patterns', () => {
    const result = generateDockerignore();

    expect(result).toContain('*.log');
  });

  it('includes test and coverage directories', () => {
    const result = generateDockerignore();

    expect(result).toContain('coverage');
  });

  it('includes turborepo cache', () => {
    const result = generateDockerignore();

    expect(result).toContain('.turbo');
  });

  it('includes IDE and OS files', () => {
    const result = generateDockerignore();

    expect(result).toContain('.vscode');
    expect(result).toContain('.DS_Store');
  });

  it('includes Docker files themselves', () => {
    const result = generateDockerignore();

    expect(result).toContain('Dockerfile');
    expect(result).toContain('.dockerignore');
  });
});
