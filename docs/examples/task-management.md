# Example: Task Management API

A full-featured task management API built with Web Loom API. This example covers six related models, JWT auth, ownership-based authorization, Drizzle joins, user-scoped queries, and file attachments.

## Domain

| Model        | Description                                                |
| ------------ | ---------------------------------------------------------- |
| `User`       | Registered users with roles (`member`, `admin`)            |
| `Project`    | A collection of tasks with a status lifecycle              |
| `Task`       | A unit of work, assigned to a user, belonging to a project |
| `Comment`    | A discussion thread entry on a task, owned by a user       |
| `Attachment` | A file linked to a task, with a computed download URL      |
| `Todo`       | A personal to-do item, private to the owning user          |

**Relationships:**

```
User ──< Task (assignee)
User ──< Comment (author)
User ──< Todo (owner)
Project ──< Task
Task ──< Comment
Task ──< Attachment
```

---

## Project Structure

```
src/
├── db/
│   └── schema.ts          # All Drizzle table definitions
├── models/
│   ├── user.model.ts
│   ├── project.model.ts
│   ├── task.model.ts
│   ├── comment.model.ts
│   ├── attachment.model.ts
│   └── todo.model.ts
├── routes/
│   ├── auth.ts
│   ├── projects.ts
│   ├── tasks.ts
│   ├── comments.ts
│   └── todos.ts
├── index.ts               # App entry point
webloom.config.ts
```

---

## 1. Database Schema

All tables in one file — the single source of truth for types and Zod schemas.

```typescript
// src/db/schema.ts
import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['member', 'admin']);
export const projectStatusEnum = pgEnum('project_status', [
  'planning',
  'active',
  'paused',
  'completed',
]);
export const taskStatusEnum = pgEnum('task_status', ['backlog', 'in-progress', 'review', 'done']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high']);

// ─── Users ────────────────────────────────────────────────────────────────────

export const usersTable = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    avatarUrl: varchar('avatar_url', { length: 255 }),
    role: userRoleEnum('role').notNull().default('member'),
    // Stored as JSON; Zod schema will type this as { theme?: 'light' | 'dark' }
    preferences: text('preferences').default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
  })
);

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projectsTable = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull().default(''),
  color: varchar('color', { length: 20 }).notNull().default('#60a5fa'),
  status: projectStatusEnum('status').notNull().default('planning'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasksTable = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull().default(''),
    status: taskStatusEnum('status').notNull().default('backlog'),
    priority: taskPriorityEnum('priority').notNull().default('medium'),
    assigneeName: varchar('assignee_name', { length: 120 }).notNull().default('Unassigned'),
    assigneeId: uuid('assignee_id').references(() => usersTable.id, { onDelete: 'set null' }),
    dueDate: timestamp('due_date'),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index('tasks_project_idx').on(t.projectId),
    statusIdx: index('tasks_status_idx').on(t.status),
    assigneeIdx: index('tasks_assignee_idx').on(t.assigneeId),
  })
);

// ─── Comments ─────────────────────────────────────────────────────────────────

export const commentsTable = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    content: text('content').notNull(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasksTable.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    taskIdx: index('comments_task_idx').on(t.taskId),
  })
);

// ─── Attachments ──────────────────────────────────────────────────────────────

export const attachmentsTable = pgTable(
  'attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasksTable.id, { onDelete: 'cascade' }),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    // storedName is an internal implementation detail — never exposed in responses
    storedName: varchar('stored_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    size: integer('size').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    taskIdx: index('attachments_task_idx').on(t.taskId),
  })
);

// ─── Todos ────────────────────────────────────────────────────────────────────

export const todosTable = pgTable(
  'todos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    details: text('details').notNull().default(''),
    completed: boolean('completed').notNull().default(false),
    dueDate: timestamp('due_date'),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('todos_user_idx').on(t.userId),
  })
);

// ─── Relations (for Drizzle relational queries) ───────────────────────────────

export const usersRelations = relations(usersTable, ({ many }) => ({
  assignedTasks: many(tasksTable),
  comments: many(commentsTable),
  todos: many(todosTable),
}));

export const projectsRelations = relations(projectsTable, ({ many }) => ({
  tasks: many(tasksTable),
}));

export const tasksRelations = relations(tasksTable, ({ one, many }) => ({
  project: one(projectsTable, { fields: [tasksTable.projectId], references: [projectsTable.id] }),
  assignee: one(usersTable, { fields: [tasksTable.assigneeId], references: [usersTable.id] }),
  comments: many(commentsTable),
  attachments: many(attachmentsTable),
}));

export const commentsRelations = relations(commentsTable, ({ one }) => ({
  task: one(tasksTable, { fields: [commentsTable.taskId], references: [tasksTable.id] }),
  author: one(usersTable, { fields: [commentsTable.authorId], references: [usersTable.id] }),
}));

export const attachmentsRelations = relations(attachmentsTable, ({ one }) => ({
  task: one(tasksTable, { fields: [attachmentsTable.taskId], references: [tasksTable.id] }),
}));

export const todosRelations = relations(todosTable, ({ one }) => ({
  owner: one(usersTable, { fields: [todosTable.userId], references: [usersTable.id] }),
}));
```

---

## 2. Models

### User

```typescript
// src/models/user.model.ts
import { defineModel } from '@web-loom/api-core';
import { z } from 'zod';
import { usersTable } from '../db/schema';

export const User = defineModel(usersTable, {
  name: 'User',
  basePath: '/users',
  crud: false, // users are managed via /auth routes
  overrides: {
    // Never include passwordHash in select responses
    select: {
      passwordHash: z
        .string()
        .optional()
        .transform(() => undefined),
    },
  },
});

// Convenience type for route handlers
export type SelectUser = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
```

### Project

```typescript
// src/models/project.model.ts
import { defineModel } from '@web-loom/api-core';
import { projectsTable } from '../db/schema';

export const Project = defineModel(projectsTable, {
  name: 'Project',
  basePath: '/projects',
  crud: false, // hand-written routes for auth control
});
```

### Task

```typescript
// src/models/task.model.ts
import { defineModel } from '@web-loom/api-core';
import { z } from 'zod';
import { tasksTable } from '../db/schema';

export const Task = defineModel(tasksTable, {
  name: 'Task',
  basePath: '/tasks',
  crud: false,
  overrides: {
    // Accept ISO date strings and coerce to Date for insert/update
    insert: {
      dueDate: z
        .string()
        .optional()
        .transform((v) => (v ? new Date(v) : null)),
    },
    update: {
      dueDate: z
        .string()
        .optional()
        .transform((v) => (v ? new Date(v) : null)),
    },
  },
});
```

### Comment, Attachment, Todo

```typescript
// src/models/comment.model.ts
import { defineModel } from '@web-loom/api-core';
import { commentsTable } from '../db/schema';
export const Comment = defineModel(commentsTable, {
  name: 'Comment',
  basePath: '/comments',
  crud: false,
});

// src/models/attachment.model.ts
import { defineModel } from '@web-loom/api-core';
import { attachmentsTable } from '../db/schema';
export const Attachment = defineModel(attachmentsTable, {
  name: 'Attachment',
  basePath: '/attachments',
  crud: false,
  overrides: {
    // Never expose storedName in responses
    select: { storedName: undefined },
  },
});

// src/models/todo.model.ts
import { defineModel } from '@web-loom/api-core';
import { todosTable } from '../db/schema';
export const Todo = defineModel(todosTable, { name: 'Todo', basePath: '/todos', crud: false });
```

---

## 3. Configuration

```typescript
// webloom.config.ts
import { defineConfig } from '@web-loom/api-core';

export default defineConfig({
  database: {
    url: process.env.DATABASE_URL!,
    driver: 'neon-serverless',
    ssl: true,
  },
  openapi: {
    enabled: true,
    title: 'TaskFlow API',
    version: '1.0.0',
    description: 'Task management API built with Web Loom API',
  },
  security: {
    cors: {
      origins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      headers: ['Content-Type', 'Authorization'],
    },
  },
});
```

---

## 4. Auth Routes

Registration, login, session introspection, and password change. The `passwordHash` column is populated here and never returned in responses.

```typescript
// src/routes/auth.ts
import { defineRoutes, validate, openApiMeta } from '@web-loom/api-core';
import { jwtAuth } from '@web-loom/api-middleware-auth';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { usersTable } from '../db/schema';
import { hashPassword, verifyPassword, signToken } from '../lib/auth';

const routes = defineRoutes();

const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(120),
  password: z.string().min(8),
  avatarUrl: z.string().url().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// POST /auth/register
routes.post(
  '/register',
  openApiMeta({ summary: 'Register a new user', tags: ['Auth'] }),
  validate('json', registerSchema),
  async (c) => {
    const { email, displayName, password, avatarUrl } = c.req.valid('json');

    const existing = await c.var.db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (existing.length > 0) {
      return c.json({ error: { code: 'CONFLICT', message: 'Email already registered' } }, 409);
    }

    const passwordHash = await hashPassword(password);
    const [user] = await c.var.db
      .insert(usersTable)
      .values({ email, displayName, passwordHash, avatarUrl })
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      });

    const token = signToken({ sub: user!.id, role: user!.role });
    return c.json({ token, user }, 201);
  }
);

// POST /auth/login
routes.post(
  '/login',
  openApiMeta({ summary: 'Authenticate and receive a JWT', tags: ['Auth'] }),
  validate('json', loginSchema),
  async (c) => {
    const { email, password } = c.req.valid('json');

    const [row] = await c.var.db.select().from(usersTable).where(eq(usersTable.email, email));

    const invalid = () =>
      c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);

    if (!row) return invalid();

    const ok = await verifyPassword(password, row.passwordHash);
    if (!ok) return invalid();

    const token = signToken({ sub: row.id, role: row.role });
    const { passwordHash: _omit, ...user } = row;
    return c.json({ token, user });
  }
);

// GET /auth/me  — requires valid JWT
routes.get(
  '/me',
  openApiMeta({ summary: 'Get the authenticated user', tags: ['Auth'] }),
  jwtAuth({ secret: process.env.JWT_SECRET! }),
  async (c) => {
    const userId = (c.var.user as { id: string }).id;

    const [row] = await c.var.db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
        role: usersTable.role,
        preferences: usersTable.preferences,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
    return c.json({ user: row });
  }
);

// POST /auth/change-password
routes.post(
  '/change-password',
  openApiMeta({ summary: 'Change the authenticated user password', tags: ['Auth'] }),
  jwtAuth({ secret: process.env.JWT_SECRET! }),
  validate('json', changePasswordSchema),
  async (c) => {
    const userId = (c.var.user as { id: string }).id;
    const { currentPassword, newPassword } = c.req.valid('json');

    const [row] = await c.var.db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    const ok = await verifyPassword(currentPassword, row.passwordHash);
    if (!ok) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Current password is incorrect' } },
        400
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await c.var.db
      .update(usersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    return c.body(null, 204);
  }
);

export default routes;
```

**`src/lib/auth.ts`** — thin helpers wrapping `bcryptjs` and `jose`:

```typescript
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export function signToken(payload: Record<string, unknown>, expiresIn = '7d') {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}
```

---

## 5. Projects Routes

```typescript
// src/routes/projects.ts
import { defineRoutes, validate, openApiMeta } from '@web-loom/api-core';
import { jwtAuth, requireRole } from '@web-loom/api-middleware-auth';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { projectsTable, tasksTable } from '../db/schema';

const routes = defineRoutes();

const auth = jwtAuth({ secret: process.env.JWT_SECRET! });

const projectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1024).optional().default(''),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional()
    .default('#60a5fa'),
  status: z.enum(['planning', 'active', 'paused', 'completed']).optional().default('planning'),
});

// GET /projects — public
routes.get('/', openApiMeta({ summary: 'List all projects', tags: ['Projects'] }), async (c) => {
  const projects = await c.var.db.select().from(projectsTable).orderBy(projectsTable.createdAt);
  return c.json({ projects });
});

// GET /projects/:id — public, includes task summary counts
routes.get(
  '/:id',
  openApiMeta({ summary: 'Get a project by ID', tags: ['Projects'] }),
  async (c) => {
    const [project] = await c.var.db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, c.req.param('id')));

    if (!project) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
    }

    // Count tasks grouped by status for the project board summary
    const taskCounts = await c.var.db
      .select({ status: tasksTable.status })
      .from(tasksTable)
      .where(eq(tasksTable.projectId, project.id));

    const summary = taskCounts.reduce<Record<string, number>>((acc, { status }) => {
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});

    return c.json({ project, taskSummary: summary });
  }
);

// POST /projects — authenticated
routes.post(
  '/',
  openApiMeta({ summary: 'Create a project', tags: ['Projects'] }),
  auth,
  validate('json', projectSchema),
  async (c) => {
    const [project] = await c.var.db.insert(projectsTable).values(c.req.valid('json')).returning();

    return c.json({ project }, 201);
  }
);

// PUT /projects/:id — authenticated
routes.put(
  '/:id',
  openApiMeta({ summary: 'Update a project', tags: ['Projects'] }),
  auth,
  validate('json', projectSchema.partial()),
  async (c) => {
    const [project] = await c.var.db
      .update(projectsTable)
      .set({ ...c.req.valid('json'), updatedAt: new Date() })
      .where(eq(projectsTable.id, c.req.param('id')))
      .returning();

    if (!project) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
    }
    return c.json({ project });
  }
);

// DELETE /projects/:id — admin only
routes.delete(
  '/:id',
  openApiMeta({ summary: 'Delete a project (admin only)', tags: ['Projects'] }),
  auth,
  requireRole('admin'),
  async (c) => {
    const result = await c.var.db
      .delete(projectsTable)
      .where(eq(projectsTable.id, c.req.param('id')))
      .returning({ id: projectsTable.id });

    if (result.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
    }
    return c.body(null, 204);
  }
);

export default routes;
```

---

## 6. Tasks Routes

Demonstrates filtering by status/assignee, loading a task with its project and assignee via Drizzle joins, and nested attachment upload.

```typescript
// src/routes/tasks.ts
import { defineRoutes, validate, openApiMeta } from '@web-loom/api-core';
import { jwtAuth } from '@web-loom/api-middleware-auth';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { tasksTable, usersTable, projectsTable, attachmentsTable } from '../db/schema';
import { requestSizeLimit, isPathTraversal } from '@web-loom/api-middleware-validation';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const routes = defineRoutes();
const auth = jwtAuth({ secret: process.env.JWT_SECRET! });

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads';
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const taskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2048).optional().default(''),
  status: z.enum(['backlog', 'in-progress', 'review', 'done']).optional().default('backlog'),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  assigneeName: z.string().max(120).optional().default('Unassigned'),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
  projectId: z.string().uuid(),
});

const filterSchema = z.object({
  status: z.enum(['backlog', 'in-progress', 'review', 'done']).optional(),
  projectId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  unassigned: z.coerce.boolean().optional(),
});

// GET /tasks — filterable list
routes.get(
  '/',
  openApiMeta({
    summary: 'List tasks',
    tags: ['Tasks'],
    request: {
      query: z.object({
        status: z.string().optional(),
        projectId: z.string().optional(),
        assigneeId: z.string().optional(),
        unassigned: z.string().optional(),
      }),
    },
  }),
  async (c) => {
    const filters = filterSchema.safeParse(c.req.queries());
    if (!filters.success) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' } },
        400
      );
    }

    const { status, projectId, assigneeId, unassigned } = filters.data;

    const conditions = [
      status ? eq(tasksTable.status, status) : undefined,
      projectId ? eq(tasksTable.projectId, projectId) : undefined,
      assigneeId ? eq(tasksTable.assigneeId, assigneeId) : undefined,
      unassigned ? isNull(tasksTable.assigneeId) : undefined,
    ].filter(Boolean);

    const tasks = await c.var.db
      .select({
        task: tasksTable,
        assignee: {
          id: usersTable.id,
          displayName: usersTable.displayName,
          avatarUrl: usersTable.avatarUrl,
        },
      })
      .from(tasksTable)
      .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(tasksTable.createdAt);

    return c.json({ tasks });
  }
);

// GET /tasks/:id — with full relations
routes.get(
  '/:id',
  openApiMeta({ summary: 'Get a task with its project and assignee', tags: ['Tasks'] }),
  async (c) => {
    const [row] = await c.var.db
      .select({
        task: tasksTable,
        project: {
          id: projectsTable.id,
          name: projectsTable.name,
          color: projectsTable.color,
          status: projectsTable.status,
        },
        assignee: {
          id: usersTable.id,
          displayName: usersTable.displayName,
          avatarUrl: usersTable.avatarUrl,
        },
      })
      .from(tasksTable)
      .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
      .where(eq(tasksTable.id, c.req.param('id')));

    if (!row) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
    }

    // Load attachments (exclude storedName)
    const attachments = await c.var.db
      .select({
        id: attachmentsTable.id,
        originalName: attachmentsTable.originalName,
        mimeType: attachmentsTable.mimeType,
        size: attachmentsTable.size,
        createdAt: attachmentsTable.createdAt,
      })
      .from(attachmentsTable)
      .where(eq(attachmentsTable.taskId, row.task.id));

    // Compute download URLs at response time — never stored in the database
    const attachmentsWithUrls = attachments.map((a) => ({
      ...a,
      downloadUrl: `${process.env.BASE_URL}/uploads/${a.id}`,
    }));

    return c.json({ ...row, attachments: attachmentsWithUrls });
  }
);

// POST /tasks — authenticated
routes.post(
  '/',
  openApiMeta({ summary: 'Create a task', tags: ['Tasks'] }),
  auth,
  validate('json', taskSchema),
  async (c) => {
    const [task] = await c.var.db.insert(tasksTable).values(c.req.valid('json')).returning();

    return c.json({ task }, 201);
  }
);

// PUT /tasks/:id — authenticated, partial update
routes.put(
  '/:id',
  openApiMeta({ summary: 'Update a task', tags: ['Tasks'] }),
  auth,
  validate('json', taskSchema.partial()),
  async (c) => {
    const [task] = await c.var.db
      .update(tasksTable)
      .set({ ...c.req.valid('json'), updatedAt: new Date() })
      .where(eq(tasksTable.id, c.req.param('id')))
      .returning();

    if (!task) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
    }
    return c.json({ task });
  }
);

// DELETE /tasks/:id — authenticated
routes.delete(
  '/:id',
  openApiMeta({ summary: 'Delete a task', tags: ['Tasks'] }),
  auth,
  async (c) => {
    const result = await c.var.db
      .delete(tasksTable)
      .where(eq(tasksTable.id, c.req.param('id')))
      .returning({ id: tasksTable.id });

    if (result.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
    }
    return c.body(null, 204);
  }
);

// POST /tasks/:id/attachments — authenticated, raw binary upload
// Client sends the file as the raw request body with:
//   Content-Type: <mime-type>
//   X-File-Name: <encoded filename>
routes.post(
  '/:id/attachments',
  openApiMeta({ summary: 'Upload a file attachment to a task', tags: ['Tasks'] }),
  auth,
  requestSizeLimit(MAX_ATTACHMENT_BYTES),
  async (c) => {
    const taskId = c.req.param('id');

    // Verify task exists
    const [task] = await c.var.db
      .select({ id: tasksTable.id })
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId));

    if (!task) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
    }

    const rawName = c.req.header('x-file-name');
    if (!rawName) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Missing X-File-Name header' } },
        400
      );
    }

    const originalName = decodeURIComponent(rawName);
    if (isPathTraversal(originalName)) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Invalid file name' } }, 403);
    }

    const mimeType = c.req.header('content-type') ?? 'application/octet-stream';
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return c.json(
        { error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'File type not allowed' } },
        415
      );
    }

    const buffer = await c.req.arrayBuffer();
    if (buffer.byteLength === 0) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Empty file' } }, 400);
    }

    const storedName = `${randomUUID()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await writeFile(join(UPLOADS_DIR, storedName), Buffer.from(buffer));

    const [attachment] = await c.var.db
      .insert(attachmentsTable)
      .values({ taskId, originalName, storedName, mimeType, size: buffer.byteLength })
      .returning({
        id: attachmentsTable.id,
        taskId: attachmentsTable.taskId,
        originalName: attachmentsTable.originalName,
        mimeType: attachmentsTable.mimeType,
        size: attachmentsTable.size,
        createdAt: attachmentsTable.createdAt,
      });

    return c.json(
      {
        attachment: {
          ...attachment,
          downloadUrl: `${process.env.BASE_URL}/uploads/${storedName}`,
        },
      },
      201
    );
  }
);

export default routes;
```

---

## 7. Comments Routes

Author-only edit and delete — shows ownership checking against `c.var.user`.

```typescript
// src/routes/comments.ts
import { defineRoutes, validate, openApiMeta } from '@web-loom/api-core';
import { jwtAuth } from '@web-loom/api-middleware-auth';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { commentsTable, usersTable } from '../db/schema';
import type { AuthUser } from '@web-loom/api-middleware-auth';

const routes = defineRoutes();
const auth = jwtAuth({ secret: process.env.JWT_SECRET! });

const createSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().min(1).max(1024),
});

const updateSchema = z.object({
  content: z.string().min(1).max(1024),
});

// GET /comments/task/:taskId — public, includes author summary
routes.get(
  '/task/:taskId',
  openApiMeta({ summary: 'List comments on a task', tags: ['Comments'] }),
  async (c) => {
    const comments = await c.var.db
      .select({
        comment: commentsTable,
        author: {
          id: usersTable.id,
          displayName: usersTable.displayName,
          avatarUrl: usersTable.avatarUrl,
        },
      })
      .from(commentsTable)
      .leftJoin(usersTable, eq(commentsTable.authorId, usersTable.id))
      .where(eq(commentsTable.taskId, c.req.param('taskId')))
      .orderBy(commentsTable.createdAt);

    return c.json({ comments });
  }
);

// POST /comments — authenticated
routes.post(
  '/',
  openApiMeta({ summary: 'Add a comment to a task', tags: ['Comments'] }),
  auth,
  validate('json', createSchema),
  async (c) => {
    const user = c.var.user as AuthUser;
    const [comment] = await c.var.db
      .insert(commentsTable)
      .values({ ...c.req.valid('json'), authorId: user.id })
      .returning();

    return c.json({ comment }, 201);
  }
);

// PUT /comments/:id — author or admin only
routes.put(
  '/:id',
  openApiMeta({ summary: 'Edit a comment (author or admin)', tags: ['Comments'] }),
  auth,
  validate('json', updateSchema),
  async (c) => {
    const user = c.var.user as AuthUser;
    const [existing] = await c.var.db
      .select({ authorId: commentsTable.authorId })
      .from(commentsTable)
      .where(eq(commentsTable.id, c.req.param('id')));

    if (!existing) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Comment not found' } }, 404);
    }
    if (existing.authorId !== user.id && user.role !== 'admin') {
      return c.json(
        { error: { code: 'FORBIDDEN', message: 'You can only edit your own comments' } },
        403
      );
    }

    const [comment] = await c.var.db
      .update(commentsTable)
      .set({ ...c.req.valid('json'), updatedAt: new Date() })
      .where(eq(commentsTable.id, c.req.param('id')))
      .returning();

    return c.json({ comment });
  }
);

// DELETE /comments/:id — author or admin only
routes.delete(
  '/:id',
  openApiMeta({ summary: 'Delete a comment (author or admin)', tags: ['Comments'] }),
  auth,
  async (c) => {
    const user = c.var.user as AuthUser;
    const [existing] = await c.var.db
      .select({ authorId: commentsTable.authorId })
      .from(commentsTable)
      .where(eq(commentsTable.id, c.req.param('id')));

    if (!existing) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Comment not found' } }, 404);
    }
    if (existing.authorId !== user.id && user.role !== 'admin') {
      return c.json(
        { error: { code: 'FORBIDDEN', message: 'You can only delete your own comments' } },
        403
      );
    }

    await c.var.db.delete(commentsTable).where(eq(commentsTable.id, c.req.param('id')));
    return c.body(null, 204);
  }
);

export default routes;
```

---

## 8. Todos Routes

Personal to-dos — every query is scoped to the authenticated user's ID. One user cannot read or modify another user's todos.

```typescript
// src/routes/todos.ts
import { defineRoutes, validate, openApiMeta } from '@web-loom/api-core';
import { jwtAuth } from '@web-loom/api-middleware-auth';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { todosTable } from '../db/schema';
import type { AuthUser } from '@web-loom/api-middleware-auth';

const routes = defineRoutes();
// All todos routes require authentication
routes.use('/*', jwtAuth({ secret: process.env.JWT_SECRET! }));

const todoSchema = z.object({
  title: z.string().min(1).max(255),
  details: z.string().max(1024).optional().default(''),
  completed: z.boolean().optional().default(false),
  dueDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});

// GET /todos — own todos only
routes.get(
  '/',
  openApiMeta({ summary: "List the authenticated user's todos", tags: ['Todos'] }),
  async (c) => {
    const user = c.var.user as AuthUser;
    const todos = await c.var.db
      .select()
      .from(todosTable)
      .where(eq(todosTable.userId, user.id))
      .orderBy(todosTable.createdAt);

    return c.json({ todos });
  }
);

// POST /todos
routes.post(
  '/',
  openApiMeta({ summary: 'Create a todo', tags: ['Todos'] }),
  validate('json', todoSchema),
  async (c) => {
    const user = c.var.user as AuthUser;
    const [todo] = await c.var.db
      .insert(todosTable)
      .values({ ...c.req.valid('json'), userId: user.id })
      .returning();

    return c.json({ todo }, 201);
  }
);

// PUT /todos/:id — own todos only
routes.put(
  '/:id',
  openApiMeta({ summary: 'Update a todo', tags: ['Todos'] }),
  validate('json', todoSchema.partial()),
  async (c) => {
    const user = c.var.user as AuthUser;
    const [todo] = await c.var.db
      .update(todosTable)
      .set({ ...c.req.valid('json'), updatedAt: new Date() })
      // Scope to userId prevents editing another user's todos
      .where(and(eq(todosTable.id, c.req.param('id')), eq(todosTable.userId, user.id)))
      .returning();

    if (!todo) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Todo not found' } }, 404);
    }
    return c.json({ todo });
  }
);

// DELETE /todos/:id — own todos only
routes.delete('/:id', openApiMeta({ summary: 'Delete a todo', tags: ['Todos'] }), async (c) => {
  const user = c.var.user as AuthUser;
  const result = await c.var.db
    .delete(todosTable)
    .where(and(eq(todosTable.id, c.req.param('id')), eq(todosTable.userId, user.id)))
    .returning({ id: todosTable.id });

  if (result.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Todo not found' } }, 404);
  }
  return c.body(null, 204);
});

export default routes;
```

---

## 9. Entry Point

```typescript
// src/index.ts
import { createApp } from '@web-loom/api-core';
import config from '../webloom.config';

// Import models so they register in ModelRegistry before createApp runs
import './models/user.model';
import './models/project.model';
import './models/task.model';
import './models/comment.model';
import './models/attachment.model';
import './models/todo.model';

const app = await createApp(config);
await app.start(Number(process.env.PORT ?? 3000));
```

The routes in `src/routes/` are discovered automatically by file-based routing. No manual registration required.

---

## 10. API Surface

| Method   | Path                     | Auth               | Description                                  |
| -------- | ------------------------ | ------------------ | -------------------------------------------- |
| `POST`   | `/auth/register`         | —                  | Register a new user                          |
| `POST`   | `/auth/login`            | —                  | Obtain a JWT                                 |
| `GET`    | `/auth/me`               | JWT                | Get own profile                              |
| `POST`   | `/auth/change-password`  | JWT                | Change own password                          |
| `GET`    | `/projects`              | —                  | List all projects                            |
| `GET`    | `/projects/:id`          | —                  | Get project with task summary                |
| `POST`   | `/projects`              | JWT                | Create a project                             |
| `PUT`    | `/projects/:id`          | JWT                | Update a project                             |
| `DELETE` | `/projects/:id`          | JWT + admin        | Delete a project                             |
| `GET`    | `/tasks`                 | —                  | List tasks (filterable)                      |
| `GET`    | `/tasks/:id`             | —                  | Get task with project, assignee, attachments |
| `POST`   | `/tasks`                 | JWT                | Create a task                                |
| `PUT`    | `/tasks/:id`             | JWT                | Update a task                                |
| `DELETE` | `/tasks/:id`             | JWT                | Delete a task                                |
| `POST`   | `/tasks/:id/attachments` | JWT                | Upload a file to a task                      |
| `GET`    | `/comments/task/:taskId` | —                  | List comments on a task                      |
| `POST`   | `/comments`              | JWT                | Add a comment                                |
| `PUT`    | `/comments/:id`          | JWT (author/admin) | Edit a comment                               |
| `DELETE` | `/comments/:id`          | JWT (author/admin) | Delete a comment                             |
| `GET`    | `/todos`                 | JWT                | List own todos                               |
| `POST`   | `/todos`                 | JWT                | Create a todo                                |
| `PUT`    | `/todos/:id`             | JWT (owner)        | Update own todo                              |
| `DELETE` | `/todos/:id`             | JWT (owner)        | Delete own todo                              |

---

## 11. Key Patterns

### Drizzle Joins for Related Data

Rather than N+1 queries, load related rows in a single join. The result shape is an object with named sub-objects per table:

```typescript
const [row] = await c.var.db
  .select({
    task: tasksTable,
    project: { id: projectsTable.id, name: projectsTable.name },
    assignee: { id: usersTable.id, displayName: usersTable.displayName },
  })
  .from(tasksTable)
  .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
  .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
  .where(eq(tasksTable.id, taskId));
```

### User-Scoped Queries

Scope any query to the authenticated user by including `userId` in the `where` clause. This prevents a user from accessing or modifying another user's data even if they guess a valid ID:

```typescript
const user = c.var.user as AuthUser;

// This fails silently (returns 404) if the todo belongs to a different user
const [todo] = await c.var.db
  .update(todosTable)
  .set(updates)
  .where(and(eq(todosTable.id, id), eq(todosTable.userId, user.id)))
  .returning();
```

### Ownership-Based Authorization

For resources not scoped by a foreign key (comments, attachments), fetch the ownership field first, then compare:

```typescript
const [existing] = await c.var.db
  .select({ authorId: commentsTable.authorId })
  .from(commentsTable)
  .where(eq(commentsTable.id, commentId));

if (existing.authorId !== user.id && user.role !== 'admin') {
  return c.json({ error: { code: 'FORBIDDEN', message: '...' } }, 403);
}
```

### Hiding Sensitive Fields

Never select `passwordHash` from the database in route handlers that return user data. Use explicit column selection to exclude it:

```typescript
const [user] = await c.var.db
  .select({
    id: usersTable.id,
    email: usersTable.email,
    displayName: usersTable.displayName,
    // passwordHash intentionally omitted
  })
  .from(usersTable)
  .where(eq(usersTable.id, userId));
```

Alternatively, define it as `undefined` in `defineModel()` overrides so it is excluded automatically from `serializeModel()` responses.

### Computed Fields

Some fields are not stored but computed at response time. The attachment `downloadUrl` is the canonical example — it is derived from `storedName` + `BASE_URL` and injected into the response object:

```typescript
const attachmentsWithUrls = attachments.map((a) => ({
  ...a,
  downloadUrl: `${process.env.BASE_URL}/uploads/${a.id}`,
}));
```

`storedName` is never selected when building the response payload.

### Middleware Scoping

Apply `jwtAuth()` globally to a router when all routes require authentication:

```typescript
routes.use('/*', jwtAuth({ secret: process.env.JWT_SECRET! }));
```

Or apply per-route for mixed public/protected endpoints:

```typescript
routes.get('/', async (c) => {
  /* public */
});
routes.post('/', auth, validate('json', schema), async (c) => {
  /* protected */
});
```

### Dynamic Filters with Drizzle

Build `where` clauses dynamically from optional query parameters by filtering out `undefined` conditions:

```typescript
const conditions = [
  status ? eq(tasksTable.status, status) : undefined,
  projectId ? eq(tasksTable.projectId, projectId) : undefined,
  assigneeId ? eq(tasksTable.assigneeId, assigneeId) : undefined,
].filter(Boolean);

const tasks = await c.var.db
  .select()
  .from(tasksTable)
  .where(conditions.length > 0 ? and(...conditions) : undefined);
```
