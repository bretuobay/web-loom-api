import type { DockerfileOptions } from './types';

const DEFAULTS: Required<DockerfileOptions> = {
  nodeVersion: '20-alpine',
  port: 3000,
  packageManager: 'npm',
  healthCheckPath: '/health/live',
  enableHealthCheck: true,
};

function installCommand(pm: 'npm' | 'pnpm' | 'yarn'): string {
  switch (pm) {
    case 'pnpm':
      return 'RUN corepack enable && pnpm install --frozen-lockfile';
    case 'yarn':
      return 'RUN corepack enable && yarn install --frozen-lockfile';
    default:
      return 'RUN npm ci';
  }
}

function buildCommand(pm: 'npm' | 'pnpm' | 'yarn'): string {
  switch (pm) {
    case 'pnpm':
      return 'RUN pnpm run build';
    case 'yarn':
      return 'RUN yarn build';
    default:
      return 'RUN npm run build';
  }
}

function startCommand(pm: 'npm' | 'pnpm' | 'yarn'): string {
  switch (pm) {
    case 'pnpm':
      return 'CMD ["pnpm", "start"]';
    case 'yarn':
      return 'CMD ["yarn", "start"]';
    default:
      return 'CMD ["node", "dist/index.js"]';
  }
}

function lockfileName(pm: 'npm' | 'pnpm' | 'yarn'): string {
  switch (pm) {
    case 'pnpm':
      return 'pnpm-lock.yaml';
    case 'yarn':
      return 'yarn.lock';
    default:
      return 'package-lock.json';
  }
}

/**
 * Generates a multi-stage Dockerfile optimised for minimal image size.
 */
export function generateDockerfile(options: DockerfileOptions = {}): string {
  const opts = { ...DEFAULTS, ...options };
  const { nodeVersion, port, packageManager, healthCheckPath, enableHealthCheck } = opts;
  const lockfile = lockfileName(packageManager);

  const lines: string[] = [
    `# ---- Stage 1: base (install dependencies) ----`,
    `FROM node:${nodeVersion} AS base`,
    `WORKDIR /app`,
    `COPY package.json ${lockfile}* ./`,
    installCommand(packageManager),
    ``,
    `# ---- Stage 2: builder (compile source) ----`,
    `FROM base AS builder`,
    `WORKDIR /app`,
    `COPY . .`,
    buildCommand(packageManager),
    ``,
    `# ---- Stage 3: runner (production image) ----`,
    `FROM node:${nodeVersion} AS runner`,
    `WORKDIR /app`,
    `ENV NODE_ENV=production`,
    ``,
    `# Create non-root user`,
    `RUN addgroup --system --gid 1001 appgroup && \\`,
    `    adduser --system --uid 1001 appuser`,
    ``,
    `# Copy only production artifacts`,
    `COPY --from=builder /app/dist ./dist`,
    `COPY --from=builder /app/package.json ./`,
    `COPY --from=builder /app/node_modules ./node_modules`,
    ``,
    `USER appuser`,
    ``,
    `EXPOSE ${port}`,
  ];

  if (enableHealthCheck) {
    lines.push(
      ``,
      `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\`,
      `  CMD wget --no-verbose --tries=1 --spider http://localhost:${port}${healthCheckPath} || exit 1`
    );
  }

  lines.push(``, startCommand(packageManager), ``);

  return lines.join('\n');
}
