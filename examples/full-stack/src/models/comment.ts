/**
 * Full-Stack Example — Comment Model
 *
 * Comments are scoped to a post and authored by a user.
 * Custom list routes filter by postId (see routes/posts.ts).
 */
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { defineModel } from '@web-loom/api-core';
import { relations } from 'drizzle-orm';
import { postsTable } from './post';
import { usersTable } from './user';

export const commentsTable = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  body: text('body').notNull(),
  postId: uuid('post_id')
    .notNull()
    .references(() => postsTable.id),
  authorId: uuid('author_id')
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const commentsRelations = relations(commentsTable, ({ one }) => ({
  post: one(postsTable, { fields: [commentsTable.postId], references: [postsTable.id] }),
  author: one(usersTable, { fields: [commentsTable.authorId], references: [usersTable.id] }),
}));

export const CommentModel = defineModel(commentsTable, {
  name: 'Comment',
  basePath: '/comments',
  crud: {
    list: { auth: false },
    create: { auth: true },
    read: { auth: false },
    update: { auth: true },
    delete: { auth: true },
  },
});

export type Comment = typeof commentsTable.$inferSelect;
export type NewComment = typeof commentsTable.$inferInsert;
