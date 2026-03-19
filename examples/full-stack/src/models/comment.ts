/**
 * Full-Stack Example — Comment Model
 *
 * Comment model with a belongsTo relationship to Post.
 * Demonstrates nested resource patterns and moderation fields.
 */
import { defineModel } from '@web-loom/api-core';

export const Comment = defineModel({
  name: 'Comment',
  tableName: 'comments',

  fields: [
    {
      name: 'id',
      type: 'uuid',
      database: { primaryKey: true, default: 'gen_random_uuid()' },
    },
    {
      name: 'body',
      type: 'text',
      validation: { required: true, minLength: 1, maxLength: 2000 },
    },
    {
      name: 'postId',
      type: 'uuid',
      validation: { required: true },
      database: { index: true, references: { model: 'Post', field: 'id' } },
    },
    {
      name: 'authorId',
      type: 'uuid',
      validation: { required: true },
      database: { index: true, references: { model: 'User', field: 'id' } },
    },
    {
      name: 'createdAt',
      type: 'datetime',
      default: () => new Date(),
    },
  ],

  relationships: [
    { type: 'belongsTo', model: 'Post', foreignKey: 'postId' },
    { type: 'belongsTo', model: 'User', foreignKey: 'authorId' },
  ],

  options: {
    timestamps: true,
    crud: {
      // Comments are scoped to a post: GET /api/posts/:postId/comments
      list: { auth: false, scope: 'post' },
      create: { auth: true },
      update: { auth: 'owner' },
      delete: { auth: 'owner' },
    },
  },
});
