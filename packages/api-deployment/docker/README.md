# @web-loom/api-deployment-docker

Docker deployment utilities for [Web Loom API](https://github.com/bretuobay/web-loom-api). Generates production-ready `Dockerfile`, `docker-compose.yml`, and `.dockerignore` templates for containerized Node.js deployments.

## Installation

```bash
npm install --save-dev @web-loom/api-deployment-docker
```

Or use the CLI (no install needed):

```bash
npx webloom generate docker
```

## Usage

### Programmatic

```typescript
import {
  generateDockerfile,
  generateDockerCompose,
  generateDockerignore,
} from '@web-loom/api-deployment-docker';
import { writeFileSync } from 'fs';

// Generate Dockerfile
const dockerfile = generateDockerfile({
  nodeVersion: '22',
  port: 3000,
  packageManager: 'npm',
  entrypoint: 'dist/index.js',
});
writeFileSync('Dockerfile', dockerfile);

// Generate docker-compose.yml with Postgres
const compose = generateDockerCompose({
  serviceName: 'api',
  port: 3000,
  database: 'postgres',
  databaseVersion: '16',
  envFile: '.env',
});
writeFileSync('docker-compose.yml', compose);

// Generate .dockerignore
const ignore = generateDockerignore();
writeFileSync('.dockerignore', ignore);
```

### Example Generated Dockerfile

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Options

### `generateDockerfile(options)`

| Option           | Type                        | Default           | Description           |
| ---------------- | --------------------------- | ----------------- | --------------------- |
| `nodeVersion`    | `string`                    | `'22'`            | Node.js version       |
| `port`           | `number`                    | `3000`            | Exposed port          |
| `packageManager` | `'npm' \| 'pnpm' \| 'yarn'` | `'npm'`           | Package manager       |
| `entrypoint`     | `string`                    | `'dist/index.js'` | Entry file            |
| `multistage`     | `boolean`                   | `true`            | Use multi-stage build |

### `generateDockerCompose(options)`

| Option            | Type                              | Default      | Description                 |
| ----------------- | --------------------------------- | ------------ | --------------------------- |
| `serviceName`     | `string`                          | `'api'`      | Docker service name         |
| `port`            | `number`                          | `3000`       | Host port mapping           |
| `database`        | `'postgres' \| 'mysql' \| 'none'` | `'postgres'` | Database service to include |
| `databaseVersion` | `string`                          | `'16'`       | Database image version      |
| `envFile`         | `string`                          | `'.env'`     | Env file path               |

## CLI Usage

```bash
# Via the webloom CLI
npx webloom generate docker

# Outputs:
#   Dockerfile
#   docker-compose.yml
#   .dockerignore
```

## Build & Deploy

```bash
# Build image
docker build -t my-api .

# Run locally
docker compose up

# Push to registry
docker tag my-api registry.example.com/my-api:latest
docker push registry.example.com/my-api:latest
```

## License

MIT
