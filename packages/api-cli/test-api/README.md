# test-api

Web Loom API project

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

3. Run database migrations:

```bash
pnpm migrate:up
```

4. Start development server:

```bash
pnpm dev
```

## Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm migrate:create` - Create a new migration
- `pnpm migrate:up` - Run pending migrations
- `pnpm migrate:down` - Rollback last migration
- `pnpm seed` - Seed database with test data
- `pnpm test` - Run tests

## Project Structure

```
src/
├── models/     # Data models
├── routes/     # API routes
└── index.ts    # Application entry point
```

## Documentation

- [Web Loom Documentation](https://webloom.dev/docs)
- [API Reference](https://webloom.dev/api)

## License

MIT
