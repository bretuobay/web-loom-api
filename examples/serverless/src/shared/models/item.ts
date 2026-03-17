/**
 * Serverless Example — Item Model
 *
 * A simple model shared across all deployment targets.
 * Kept lightweight to minimize cold start overhead.
 */
import { defineModel } from "@web-loom/api-core";

export const Item = defineModel({
  name: "Item",
  tableName: "items",

  fields: [
    {
      name: "id",
      type: "uuid",
      database: { primaryKey: true, default: "gen_random_uuid()" },
    },
    {
      name: "name",
      type: "string",
      validation: { required: true, minLength: 1, maxLength: 200 },
    },
    {
      name: "description",
      type: "text",
    },
    {
      name: "price",
      type: "number",
      validation: { required: true, min: 0 },
    },
    {
      name: "createdAt",
      type: "datetime",
      default: () => new Date(),
    },
  ],

  options: {
    timestamps: true,
    crud: true,
  },
});
