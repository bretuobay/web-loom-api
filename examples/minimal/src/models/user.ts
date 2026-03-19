/**
 * Minimal Example — User Model
 *
 * Defines the User model using defineModel(). The framework uses this
 * definition to generate database schemas, validation rules, CRUD routes,
 * and TypeScript types automatically.
 */
import { defineModel } from '@web-loom/api-core';

export const User = defineModel({
  name: 'User',
  tableName: 'users',

  fields: [
    {
      name: 'id',
      type: 'uuid',
      database: { primaryKey: true, default: 'gen_random_uuid()' },
    },
    {
      name: 'name',
      type: 'string',
      validation: { required: true, minLength: 1, maxLength: 100 },
    },
    {
      name: 'email',
      type: 'string',
      validation: { required: true, format: 'email' },
      database: { unique: true },
    },
    {
      name: 'password',
      type: 'string',
      validation: { required: true, minLength: 8 },
      // Excluded from API responses by default
      database: { select: false },
    },
    {
      name: 'createdAt',
      type: 'datetime',
      default: () => new Date(),
      database: { index: true },
    },
  ],

  options: {
    timestamps: true,
    // Auto-generate CRUD endpoints for this model
    crud: true,
  },
});
