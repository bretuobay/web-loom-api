/**
 * Minimal Example — User Model
 *
 * Defines the Drizzle table schema first, then registers it as a Web Loom
 * model. The select schema override hides the password hash from API responses.
 */
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { defineModel } from '@web-loom/api-core';
import { z } from 'zod';

export const usersTable = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Exclude passwordHash from public API responses
const userSelectSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.date(),
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
