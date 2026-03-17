/**
 * Full-Stack Example — Post Model
 *
 * Post model with a belongsTo relationship to User and a hasMany
 * relationship to Comment. Demonstrates caching and webhook triggers.
 */
import { defineModel } from "@web-loom/api-core";

export const Post = defineModel({
  name: "Post",
  tableName: "posts",

  fields: [
    {
      name: "id",
      type: "uuid",
      database: { primaryKey: true, default: "gen_random_uuid()" },
    },
    {
      name: "title",
      type: "string",
      validation: { required: true, minLength: 1, maxLength: 200 },
    },
    {
      name: "content",
      type: "text",
      validation: { required: true },
    },
    {
      name: "slug",
      type: "string",
      database: { unique: true, index: true },
      // Computed from title on create
      computed: true,
    },
    {
      name: "status",
      type: "enum",
      validation: { enum: ["draft", "published", "archived"] },
      default: "draft",
    },
    {
      name: "userId",
      type: "uuid",
      validation: { required: true },
      database: { index: true, references: { model: "User", field: "id" } },
    },
    {
      name: "publishedAt",
      type: "datetime",
    },
    {
      name: "createdAt",
      type: "datetime",
      default: () => new Date(),
    },
    {
      name: "updatedAt",
      type: "datetime",
      default: () => new Date(),
    },
  ],

  relationships: [
    { type: "belongsTo", model: "User", foreignKey: "userId" },
    { type: "hasMany", model: "Comment", foreignKey: "postId" },
  ],

  options: {
    timestamps: true,
    softDelete: true,
    crud: {
      list: { auth: false, cache: { ttl: 60, tags: ["posts"] } },
      read: { auth: false, cache: { ttl: 120, tags: ["posts"] } },
      create: { auth: true },
      update: { auth: "owner" },
      delete: { auth: "owner" },
    },
  },
});
