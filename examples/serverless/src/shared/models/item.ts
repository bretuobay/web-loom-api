/**
 * Serverless Example — Item Model
 *
 * Lightweight Drizzle table + defineModel registration.
 * Kept minimal to reduce cold start overhead.
 */
import { pgTable, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core';
import { defineModel } from '@web-loom/api-core';

export const itemsTable = pgTable('items', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ItemModel = defineModel(itemsTable, {
  name: 'Item',
  basePath: '/items',
  crud: {
    list: { auth: false },
    create: { auth: false },
    read: { auth: false },
    update: { auth: false },
    delete: { auth: false },
  },
});

export type Item = typeof itemsTable.$inferSelect;
export type NewItem = typeof itemsTable.$inferInsert;
