/**
 * Full-Stack Example — User Model
 *
 * Drizzle table first, then registered with defineModel. The select schema
 * override strips the password hash and API key from all API responses.
 */
import { pgTable, pgEnum, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { defineModel } from '@web-loom/api-core';
import { z } from 'zod';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin', 'moderator']);

export const usersTable = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  avatarUrl: text('avatar_url'),
  apiKey: text('api_key').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'), // soft-delete
});

// Public shape — hides credential fields
const userSelectSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['user', 'admin', 'moderator']),
  avatarUrl: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const UserModel = defineModel(
  usersTable,
  {
    name: 'User',
    basePath: '/users',
    crud: {
      list: { auth: true },
      create: { auth: false },
      read: { auth: false },
      update: { auth: true },
      delete: { auth: true },
    },
  },
  { select: userSelectSchema }
);

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
