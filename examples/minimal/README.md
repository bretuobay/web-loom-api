# Minimal Example — @web-loom/api

A simple CRUD API with one model and basic authentication. This is the fastest way to get started with Web Loom API.

## What This Example Demonstrates

- Defining a model with `defineModel()`
- Creating CRUD routes with `defineRoutes()`
- Bootstrapping an app with `createApp()`
- Session-based authentication with `sessionAuth()`

## Project Structure

```
src/
├── index.ts          # App entry point
├── config.ts         # App configuration
├── models/
│   └── user.ts       # User model definition
└── routes/
    └── users.ts      # User CRUD routes
```

## Getting Started

### 1. Install dependencies

```bash
npm install @web-loom/api-core @web-loom/api-adapter-hono \
  @web-loom/api-adapter-drizzle @web-loom/api-adapter-zod \
  @web-loom/api-middleware-auth
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your database URL
```

```env
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
SESSION_SECRET=your-secret-key-here
PORT=3000
```

### 3. Run the development server

```bash
npx web-loom dev
```

### 4. Try the API

```bash
# Create a user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com", "password": "secret123"}'

# List all users (requires auth)
curl http://localhost:3000/api/users \
  -H "Cookie: session=<session-token>"

# Get a single user
curl http://localhost:3000/api/users/1

# Update a user
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<session-token>" \
  -d '{"name": "Alice Updated"}'

# Delete a user
curl -X DELETE http://localhost:3000/api/users/1 \
  -H "Cookie: session=<session-token>"
```

## API Endpoints

| Method | Path             | Auth     | Description       |
|--------|------------------|----------|-------------------|
| GET    | `/api/users`     | Required | List all users    |
| POST   | `/api/users`     | None     | Create a user     |
| GET    | `/api/users/:id` | None     | Get user by ID    |
| PUT    | `/api/users/:id` | Required | Update a user     |
| DELETE | `/api/users/:id` | Required | Delete a user     |
| POST   | `/api/auth/login`| None     | Log in            |
