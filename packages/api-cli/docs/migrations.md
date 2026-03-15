# Database Migrations

Web Loom provides a robust database migration system for managing schema changes over time.

## Overview

Migrations are version control for your database schema. They allow you to:
- Track schema changes over time
- Apply changes consistently across environments
- Rollback changes if needed
- Collaborate with team members on schema changes

## Migration Files

Migration files are TypeScript files with a specific structure:

```typescript
import type { DatabaseAdapter } from '@web-loom/api-core';

export class CreateUsersTable {
  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
  }

  async down(db: DatabaseAdapter): Promise<void> {
    await db.execute('DROP TABLE IF EXISTS users');
  }
}
```

## Commands

### Create a Migration

```bash
webloom migrate create <name>
```

Creates a new migration file with a timestamp prefix:

```bash
webloom migrate create create_users_table
# Creates: 20240115_120000_create_users_table.ts
```

Options:
- `-d, --dir <directory>`: Migrations directory (default: `src/migrations`)

### Apply Migrations

```bash
webloom migrate up
```

Applies all pending migrations in chronological order.

Options:
- `-d, --dir <directory>`: Migrations directory (default: `src/migrations`)
- `-s, --steps <number>`: Number of migrations to apply (default: all)

Examples:
```bash
# Apply all pending migrations
webloom migrate up

# Apply next 2 migrations
webloom migrate up --steps 2
```

### Rollback Migrations

```bash
webloom migrate down
```

Reverts the last applied migration(s).

Options:
- `-d, --dir <directory>`: Migrations directory (default: `src/migrations`)
- `-s, --steps <number>`: Number of migrations to revert (default: 1)

Examples:
```bash
# Revert last migration
webloom migrate down

# Revert last 3 migrations
webloom migrate down --steps 3
```

### Check Status

```bash
webloom migrate status
```

Shows the status of all migrations (applied/pending).

Options:
- `-d, --dir <directory>`: Migrations directory (default: `src/migrations`)

## Migration Tracking

Migrations are tracked in a `migrations` table in your database:

```sql
CREATE TABLE migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
  batch INTEGER NOT NULL
);
```

### Batch System

Migrations are grouped into batches. Each time you run `migrate up`, all applied migrations are assigned the same batch number. This allows you to rollback an entire deployment at once.

Example:
```bash
# First deployment
webloom migrate up
# Applies migrations 001, 002, 003 as batch 1

# Second deployment
webloom migrate up
# Applies migrations 004, 005 as batch 2

# Rollback second deployment
webloom migrate down --steps 2
# Reverts migrations 005, 004
```

## Best Practices

### 1. Always Write Down Migrations

Every migration should have a corresponding `down()` method that reverses the changes:

```typescript
async up(db: DatabaseAdapter): Promise<void> {
  await db.execute('ALTER TABLE users ADD COLUMN age INTEGER');
}

async down(db: DatabaseAdapter): Promise<void> {
  await db.execute('ALTER TABLE users DROP COLUMN age');
}
```

### 2. Use Transactions

Migrations run inside transactions by default. If any part fails, the entire migration is rolled back:

```typescript
async up(db: DatabaseAdapter): Promise<void> {
  // All these statements run in a single transaction
  await db.execute('CREATE TABLE posts (...)');
  await db.execute('CREATE INDEX idx_posts_author ON posts(author_id)');
  await db.execute('ALTER TABLE users ADD COLUMN post_count INTEGER DEFAULT 0');
}
```

### 3. Make Migrations Idempotent

Use `IF EXISTS` and `IF NOT EXISTS` clauses when possible:

```typescript
async up(db: DatabaseAdapter): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (...)
  `);
}

async down(db: DatabaseAdapter): Promise<void> {
  await db.execute('DROP TABLE IF EXISTS users');
}
```

### 4. Never Modify Applied Migrations

Once a migration has been applied to production, never modify it. Instead, create a new migration to make additional changes.

❌ Bad:
```typescript
// Modifying an already-applied migration
async up(db: DatabaseAdapter): Promise<void> {
  await db.execute('CREATE TABLE users (...)');
  await db.execute('ALTER TABLE users ADD COLUMN age INTEGER'); // Added later
}
```

✅ Good:
```typescript
// Create a new migration
// 20240116_120000_add_age_to_users.ts
async up(db: DatabaseAdapter): Promise<void> {
  await db.execute('ALTER TABLE users ADD COLUMN age INTEGER');
}
```

### 5. Test Migrations

Always test both `up()` and `down()` methods:

```bash
# Apply migration
webloom migrate up --steps 1

# Verify changes
# ... check database ...

# Rollback
webloom migrate down --steps 1

# Verify rollback
# ... check database ...

# Re-apply
webloom migrate up --steps 1
```

### 6. Keep Migrations Small

Create focused migrations that do one thing:

✅ Good:
- `create_users_table.ts`
- `add_email_index_to_users.ts`
- `add_role_to_users.ts`

❌ Bad:
- `update_entire_schema.ts` (too broad)

### 7. Use Descriptive Names

Migration names should clearly describe what they do:

✅ Good:
- `create_users_table`
- `add_email_index_to_users`
- `rename_username_to_email`

❌ Bad:
- `migration1`
- `update`
- `fix`

## Common Patterns

### Creating Tables

```typescript
async up(db: DatabaseAdapter): Promise<void> {
  await db.execute(`
    CREATE TABLE posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      published BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

async down(db: DatabaseAdapter): Promise<void> {
  await db.execute('DROP TABLE IF EXISTS posts');
}
```

### Adding Columns

```typescript
async up(db: DatabaseAdapter): Promise<void> {
  await db.execute(`
    ALTER TABLE users 
    ADD COLUMN avatar_url VARCHAR(500),
    ADD COLUMN bio TEXT
  `);
}

async down(db: DatabaseAdapter): Promise<void> {
  await db.execute(`
    ALTER TABLE users 
    DROP COLUMN avatar_url,
    DROP COLUMN bio
  `);
}
```

### Creating Indexes

```typescript
async up(db: DatabaseAdapter): Promise<void> {
  await db.execute(`
    CREATE INDEX idx_posts_author_id ON posts(author_id)
  `);
  await db.execute(`
    CREATE INDEX idx_posts_published ON posts(published) WHERE published = true
  `);
}

async down(db: DatabaseAdapter): Promise<void> {
  await db.execute('DROP INDEX IF EXISTS idx_posts_author_id');
  await db.execute('DROP INDEX IF EXISTS idx_posts_published');
}
```

### Data Migrations

```typescript
async up(db: DatabaseAdapter): Promise<void> {
  // Add new column
  await db.execute('ALTER TABLE users ADD COLUMN full_name VARCHAR(255)');
  
  // Populate from existing data
  await db.execute(`
    UPDATE users 
    SET full_name = first_name || ' ' || last_name
  `);
  
  // Make it required
  await db.execute('ALTER TABLE users ALTER COLUMN full_name SET NOT NULL');
}

async down(db: DatabaseAdapter): Promise<void> {
  await db.execute('ALTER TABLE users DROP COLUMN full_name');
}
```

## Troubleshooting

### Migration Failed

If a migration fails, it will be automatically rolled back. Fix the issue and run `migrate up` again.

### Migration Stuck

If a migration appears stuck, check your database for long-running queries or locks.

### Out of Sync

If your migrations table is out of sync with your actual schema:

1. **Never** manually edit the migrations table
2. Create a new migration to fix the schema
3. If necessary, reset the database and re-run all migrations

### Conflicts

If multiple developers create migrations with similar timestamps:

1. Rename one migration file to have a later timestamp
2. Ensure migrations are applied in the correct order

## Production Deployment

### Pre-Deployment Checklist

- [ ] All migrations tested locally
- [ ] Both up() and down() methods tested
- [ ] Migrations reviewed by team
- [ ] Database backup created
- [ ] Rollback plan prepared

### Deployment Process

```bash
# 1. Backup database
pg_dump mydb > backup.sql

# 2. Apply migrations
webloom migrate up

# 3. Verify application works
# ... test application ...

# 4. If issues, rollback
webloom migrate down --steps N
```

### Zero-Downtime Migrations

For production systems, follow these patterns:

1. **Add columns as nullable first**:
```typescript
// Migration 1: Add column as nullable
await db.execute('ALTER TABLE users ADD COLUMN email VARCHAR(255)');

// Migration 2 (later): Make it required
await db.execute('ALTER TABLE users ALTER COLUMN email SET NOT NULL');
```

2. **Rename in multiple steps**:
```typescript
// Migration 1: Add new column
await db.execute('ALTER TABLE users ADD COLUMN email VARCHAR(255)');

// Migration 2: Copy data
await db.execute('UPDATE users SET email = username');

// Migration 3: Drop old column
await db.execute('ALTER TABLE users DROP COLUMN username');
```

## See Also

- [Database Adapters](./adapters.md)
- [Model Definitions](./models.md)
- [CLI Commands](./cli.md)
