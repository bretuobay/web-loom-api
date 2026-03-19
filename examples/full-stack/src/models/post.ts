/**
 * Full-Stack Example — Post Model
 *
 * Supports draft/published/archived statuses, soft-delete, and a foreign key
 * to the users table. The slug is generated from the title in the route handler.
 */
import { pgTable, pgEnum, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { defineModel } from '@web-loom/api-core';
import { usersTable } from './user';
import { relations } from 'drizzle-orm';

export const postStatusEnum = pgEnum('post_status', ['draft', 'published', 'archived']);

export const postsTable = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  slug: text('slug').notNull().unique(),
  status: postStatusEnum('status').notNull().default('draft'),
  userId: uuid('user_id')
    .notNull()
    .references(() => usersTable.id),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'), // soft-delete
});

export const postsRelations = relations(postsTable, ({ one }) => ({
  author: one(usersTable, { fields: [postsTable.userId], references: [usersTable.id] }),
}));

export const PostModel = defineModel(postsTable, {
  name: 'Post',
  basePath: '/posts',
  crud: {
    list: { auth: false },
    create: { auth: true },
    read: { auth: false },
    update: { auth: true },
    delete: { auth: true },
  },
});

export type Post = typeof postsTable.$inferSelect;
export type NewPost = typeof postsTable.$inferInsert;
