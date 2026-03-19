# Full-Stack Example — @web-loom/api

A production-ready API demonstrating the full feature set of Web Loom API: multiple models with relationships, authentication, authorization, caching, file uploads, background jobs, and webhooks.

## What This Example Demonstrates

- Multiple models with relationships (`User → Post → Comment`)
- Session + API key authentication
- Role-based access control (RBAC)
- Caching with tag-based invalidation
- File uploads with storage adapters
- Background jobs for async processing
- Webhooks for event-driven integrations

## Project Structure

```
src/
├── index.ts                    # App entry point
├── config.ts                   # Full configuration
├── models/
│   ├── user.ts                 # User model with auth fields
│   ├── post.ts                 # Post model (belongs to User)
│   └── comment.ts              # Comment model (belongs to Post)
├── routes/
│   ├── users.ts                # User routes with auth
│   ├── posts.ts                # Post routes with caching
│   └── uploads.ts              # File upload routes
├── middleware/
│   └── auth.ts                 # Auth middleware setup
├── jobs/
│   └── email-notification.ts   # Background email job
└── webhooks/
    └── post-created.ts         # Webhook handler
```

## Getting Started

### 1. Install dependencies

```bash
npm install @web-loom/api-core @web-loom/api-adapter-hono \
  @web-loom/api-adapter-drizzle @web-loom/api-adapter-zod \
  @web-loom/api-adapter-lucia @web-loom/api-adapter-resend \
  @web-loom/api-middleware-auth
```

### 2. Set up environment variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
DATABASE_READ_URL=postgresql://user:password@localhost:5432/myapp
RESEND_API_KEY=re_xxxxxxxxxxxx
FRONTEND_URL=http://localhost:3000
WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
PORT=3000
```

### 3. Run the development server

```bash
npx web-loom dev
```

## Architecture Overview

### Authentication Flow

The app supports two auth strategies that work together:

1. **Session auth** — For browser clients. Login returns a `session` cookie.
2. **API key auth** — For programmatic access. Pass `X-API-Key` header.

Both strategies resolve to the same `ctx.user` object in route handlers.

### Caching Strategy

- `GET /api/posts` and `GET /api/posts/:id` are cached with the `posts` tag
- When a post is created, updated, or deleted, the `posts` tag is invalidated
- Cache TTL is 60s for lists, 120s for individual posts

### Background Jobs

When a post is created, an `email-notification` job is enqueued. The job:

1. Fetches the post and all users
2. Sends batch email notifications via the Resend adapter
3. Retries up to 3 times with exponential backoff on failure

### Webhooks

The `post.created` webhook fires when a new post is created. Subscribers receive a signed payload with the post ID, title, and author. Payloads are signed with HMAC-SHA256 for verification.

## API Endpoints

| Method | Path                     | Auth     | Description            |
| ------ | ------------------------ | -------- | ---------------------- |
| POST   | `/api/users`             | None     | Sign up                |
| POST   | `/api/auth/login`        | None     | Log in                 |
| POST   | `/api/auth/logout`       | Required | Log out                |
| GET    | `/api/users`             | Admin    | List all users         |
| POST   | `/api/users/:id/api-key` | Owner    | Generate API key       |
| GET    | `/api/posts`             | None     | List published posts   |
| GET    | `/api/posts/:id`         | None     | Get post with comments |
| POST   | `/api/posts`             | Required | Create a post          |
| PUT    | `/api/posts/:id`         | Owner    | Update a post          |
| DELETE | `/api/posts/:id`         | Owner    | Delete a post          |
| POST   | `/api/uploads/avatar`    | Required | Upload avatar          |
| DELETE | `/api/uploads/avatar`    | Required | Remove avatar          |
