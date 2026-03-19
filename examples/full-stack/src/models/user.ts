/**
 * Full-Stack Example — User Model
 *
 * User model with authentication fields, role-based access, and
 * a one-to-many relationship with Posts.
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
      database: { select: false },
    },
    {
      name: 'role',
      type: 'enum',
      validation: { enum: ['user', 'admin', 'moderator'] },
      default: 'user',
    },
    {
      name: 'avatarUrl',
      type: 'string',
      validation: { format: 'url' },
    },
    {
      name: 'apiKey',
      type: 'string',
      database: { unique: true, select: false },
    },
    {
      name: 'createdAt',
      type: 'datetime',
      default: () => new Date(),
    },
    {
      name: 'updatedAt',
      type: 'datetime',
      default: () => new Date(),
    },
  ],

  // Relationships are used by the CRUD generator and query builder
  relationships: [{ type: 'hasMany', model: 'Post', foreignKey: 'userId' }],

  options: {
    timestamps: true,
    softDelete: true,
    crud: {
      // Only admins can list all users
      list: { auth: 'admin' },
      // Anyone can create (sign up)
      create: { auth: false },
      // Users can read public profiles
      read: { auth: false },
      // Users can update their own profile
      update: { auth: 'owner' },
      delete: { auth: 'admin' },
    },
  },
});
