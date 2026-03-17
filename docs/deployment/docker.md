# Deploy with Docker

Containerize your Web Loom API for deployment to any Docker-compatible platform.

## Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
```

## .dockerignore

```
node_modules
dist
.env
.env.*
.git
*.md
tests
```

## Build and Run

```bash
# Build the image
docker build -t my-api .

# Run with environment variables
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://host:5432/mydb \
  -e NODE_ENV=production \
  my-api
```


## Docker Compose

For local development with a database:

```yaml
# docker-compose.yml
version: "3.8"

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp
      NODE_ENV: development
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./src:/app/src  # Hot reload in dev

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

```bash
docker compose up
```

## Health Checks

Add a health check to your Dockerfile:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
```

## Multi-Platform Builds

Build for both AMD64 and ARM64:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t my-api:latest --push .
```

## Production Optimizations

### Smaller Image with Distroless

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app .
CMD ["dist/index.js"]
```

### Non-Root User

```dockerfile
FROM node:20-alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=builder --chown=appuser:appgroup /app .
USER appuser
CMD ["node", "dist/index.js"]
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NODE_ENV` | Yes | `production` or `development` |
| `PORT` | No | Server port (default: 3000) |
| `RESEND_API_KEY` | If email enabled | Resend API key |

Pass via `-e` flags, `.env` file, or Docker Compose `environment` section.

## Deploying to Container Platforms

### AWS ECS / Fargate

```bash
# Push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker tag my-api:latest <account>.dkr.ecr.<region>.amazonaws.com/my-api:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/my-api:latest
```

### Google Cloud Run

```bash
gcloud run deploy my-api --image my-api:latest --port 3000
```

### Fly.io

```bash
fly launch
fly deploy
```

## Troubleshooting

**Container exits immediately**: Check logs with `docker logs <container>`. Ensure `DATABASE_URL` is set and the database is reachable.

**Connection refused to database**: In Docker Compose, use the service name (`db`) as the hostname, not `localhost`.

**Large image size**: Use multi-stage builds and `--production` flag for `npm ci`. Target image should be under 150MB.
